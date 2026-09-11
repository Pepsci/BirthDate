const express = require("express");
const router = express.Router();
const rateLimit = require("express-rate-limit");
const { ipKeyGenerator } = require("express-rate-limit");
const User = require("../models/user.model");
const Log = require("../models/log.model");
const SupportMessage = require("../models/supportMessage.model");
const { isAuthenticated } = require("../middleware/jwt.middleware");
const { sendSupportEmail } = require("../services/emailTemplates/supportEmail");

function getIp(req) {
  return (
    req.headers["x-forwarded-for"]?.split(",")[0].trim() ||
    req.connection.remoteAddress
  );
}

async function logSupportMessage(req, userId, metadata) {
  try {
    await Log.create({
      userId: userId || undefined,
      action: "support_message",
      ipAddress: getIp(req),
      userAgent: req.headers["user-agent"],
      metadata,
    });
  } catch (logError) {
    console.error("❌ Erreur logging support:", logError);
  }
}

// Formulaire authentifié : abus borné par l'existence d'un compte, mais on
// garde un plafond raisonnable par utilisateur.
const supportLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) =>
    req.payload?._id ? String(req.payload._id) : ipKeyGenerator(req),
  message: { message: "Trop de messages envoyés, réessayez plus tard." },
});

// Formulaire public : sans compte à protéger, seule l'IP + l'email fourni
// permettent de limiter — endpoint ouvert, cible privilégiée des bots qui
// testent les formulaires de contact avec du contenu aléatoire.
const supportPublicLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const email = String(req.body?.email || "").trim().toLowerCase();
    return `${ipKeyGenerator(req)}:${email || "no-email"}`;
  },
  message: { message: "Trop de messages envoyés, réessayez plus tard." },
});

// Garde-fou par IP seule sur le formulaire public : empêche un bot de
// contourner le plafond ci-dessus en changeant d'email à chaque essai.
const supportPublicLimiterByIp = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: ipKeyGenerator,
  message: { message: "Trop de messages envoyés depuis cette adresse, réessayez plus tard." },
});

// Limiteur pour les réponses d'un utilisateur connecté dans un fil déjà
// ouvert — plus permissif qu'un nouveau ticket, c'est une conversation.
const supportReplyLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) =>
    req.payload?._id ? String(req.payload._id) : ipKeyGenerator(req),
  message: { message: "Trop de messages envoyés, réessayez plus tard." },
});

// POST /api/support -> envoie un message au support (utilisateur connecté)
// Crée un ticket persistant (visible et à qui répondre depuis l'admin) en
// plus de l'email de notification à l'équipe.
router.post("/", isAuthenticated, supportLimiter, async (req, res) => {
  try {
    const { subject, message } = req.body;
    if (!subject || !subject.trim()) {
      return res.status(400).json({ message: "L'objet est requis" });
    }
    if (!message || !message.trim()) {
      return res.status(400).json({ message: "Le message est requis" });
    }
    // Un seul ticket actif à la fois : ça garde une vraie conversation avec
    // le support plutôt que plusieurs fils parallèles, et évite qu'un
    // utilisateur en ouvre un nouveau sans avoir vu qu'il en a déjà un en
    // cours. Le front redirige normalement vers ce fil avant d'arriver ici
    // (voir ContactPage) ; ce garde-fou couvre juste la course possible.
    const existing = await SupportMessage.findOne({
      userId: req.payload._id,
      status: { $ne: "closed" },
    });
    if (existing) {
      return res.status(409).json({
        message: "Tu as déjà une conversation en cours avec le support.",
        ticket: existing,
      });
    }
    const user = await User.findById(req.payload._id).select(
      "name surname email",
    );
    const fromName = user
      ? `${user.name} ${user.surname || ""}`.trim()
      : undefined;

    const ticket = await SupportMessage.create({
      userId: req.payload._id,
      name: fromName,
      email: user?.email,
      subject: subject.trim(),
      status: "open",
      messages: [{ sender: "user", body: message.trim() }],
      lastMessageAt: new Date(),
      unreadAdmin: true,
    });

    // Garde l'email de notification à l'équipe : le centre d'aide admin n'est
    // pas forcément ouvert en permanence, l'email reste le déclencheur. Le
    // push socket en plus, pour les admins déjà sur la page (voir server.js
    // pour la room "admin" et AdminSupport.jsx pour l'écoute).
    await sendSupportEmail({
      fromEmail: user?.email,
      fromName,
      subject,
      message,
    });
    req.app.get("io")?.to("admin").emit("admin:support:message", { ticket });
    await logSupportMessage(req, req.payload._id);
    res.status(200).json({ success: true, ticket });
  } catch (error) {
    console.error("❌ Support email error:", error);
    res.status(500).json({ message: "Erreur lors de l'envoi du message" });
  }
});

// POST /api/support/public -> formulaire de contact public (sans compte)
router.post("/public", supportPublicLimiterByIp, supportPublicLimiter, async (req, res) => {
  try {
    const { email, name, subject, message } = req.body;
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email || "");
    if (!emailOk) {
      return res.status(400).json({ message: "Email invalide" });
    }
    if (!subject || !subject.trim()) {
      return res.status(400).json({ message: "L'objet est requis" });
    }
    if (!message || !message.trim()) {
      return res.status(400).json({ message: "Le message est requis" });
    }
    const cleanEmail = email.trim().toLowerCase();

    const ticket = await SupportMessage.create({
      name: name?.trim() || "Visiteur",
      email: cleanEmail,
      subject: subject.trim(),
      status: "open",
      messages: [{ sender: "user", body: message.trim() }],
      lastMessageAt: new Date(),
      unreadAdmin: true,
    });

    await sendSupportEmail({
      fromEmail: cleanEmail,
      fromName: name?.trim() || "Visiteur",
      subject,
      message,
    });
    req.app.get("io")?.to("admin").emit("admin:support:message", { ticket });
    await logSupportMessage(req, null, { email: cleanEmail });
    res.status(200).json({ success: true });
  } catch (error) {
    console.error("❌ Support public email error:", error);
    res.status(500).json({ message: "Erreur lors de l'envoi du message" });
  }
});

// GET /api/support/mine -> les tickets de l'utilisateur connecté (chat)
// Ne marque rien comme lu : sert aussi à calculer le badge "non lu" de
// l'onglet Support sans le faire disparaître avant que l'utilisateur ait
// réellement ouvert le fil concerné (voir /mine/:id ci-dessous).
router.get("/mine", isAuthenticated, async (req, res) => {
  try {
    const tickets = await SupportMessage.find({ userId: req.payload._id })
      .sort({ lastMessageAt: -1 })
      .limit(20);
    res.json({ tickets });
  } catch (error) {
    console.error("❌ Erreur récupération tickets support:", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// GET /api/support/mine/:id -> détail d'un ticket, marque comme lu côté user
router.get("/mine/:id", isAuthenticated, async (req, res) => {
  try {
    const ticket = await SupportMessage.findOne({
      _id: req.params.id,
      userId: req.payload._id,
    });
    if (!ticket) {
      return res.status(404).json({ message: "Ticket introuvable" });
    }
    if (ticket.unreadUser) {
      ticket.unreadUser = false;
      await ticket.save();
    }
    res.json({ ticket });
  } catch (error) {
    console.error("❌ Erreur détail ticket support:", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// POST /api/support/mine/:id/reply -> l'utilisateur répond dans son fil
router.post(
  "/mine/:id/reply",
  isAuthenticated,
  supportReplyLimiter,
  async (req, res) => {
    try {
      const { message } = req.body;
      if (!message || !message.trim()) {
        return res.status(400).json({ message: "Le message est requis" });
      }
      const ticket = await SupportMessage.findOne({
        _id: req.params.id,
        userId: req.payload._id,
      });
      if (!ticket) {
        return res.status(404).json({ message: "Ticket introuvable" });
      }
      // Un ticket fermé (problème résolu) ne se rouvre plus tout seul sur un
      // nouveau message : ça ferait revivre indéfiniment une conversation
      // que l'admin a explicitement close. Le front grise l'input dans ce
      // cas ; ce blocage côté serveur est ce qui le garantit vraiment.
      if (ticket.status === "closed") {
        return res.status(409).json({
          message: "Ce ticket est fermé, ouvre un nouveau sujet pour une nouvelle demande.",
          ticket,
        });
      }
      ticket.messages.push({ sender: "user", body: message.trim() });
      ticket.status = "open";
      ticket.unreadAdmin = true;
      ticket.lastMessageAt = new Date();
      await ticket.save();
      req.app.get("io")?.to("admin").emit("admin:support:message", { ticket });
      res.json({ success: true, ticket });
    } catch (error) {
      console.error("❌ Erreur réponse ticket support:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  },
);

module.exports = router;
