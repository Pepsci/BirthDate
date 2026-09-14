const express = require("express");
const router = express.Router();
const rateLimit = require("express-rate-limit");
const { ipKeyGenerator } = require("express-rate-limit");
const User = require("../models/user.model");
const Log = require("../models/log.model");
const SupportMessage = require("../models/supportMessage.model");
const Event = require("../models/event.model");
const GiftPoolContribution = require("../models/giftPoolContribution.model");
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
    const { subject, message, eventShortId, category: askedCategory } = req.body;
    if (!subject || !subject.trim()) {
      return res.status(400).json({ message: "L'objet est requis" });
    }
    if (!message || !message.trim()) {
      return res.status(400).json({ message: "Le message est requis" });
    }

    // ── Litige de cagnotte : régime distinct ──────────────────────────────
    //
    // ⚠️ La règle « une seule conversation à la fois » ne peut pas s'appliquer
    // ici. Elle sert à éviter des fils parallèles sur le même sujet ; appliquée
    // aux cagnottes, elle empêche quelqu'un qui a une question en cours sur
    // autre chose de signaler qu'il n'a pas été remboursé. C'est le seul cas
    // où de l'argent est en jeu, et c'était précisément celui qu'on bloquait.
    //
    // Le plafond devient : un ticket ouvert PAR CAGNOTTE concernée. Leur
    // nombre est donc borné par celui des cagnottes auxquelles la personne a
    // réellement contribué — vérifié ci-dessous, pas déclaré par le client.
    //
    // ⚠️ C'est la CATÉGORIE qui décide de l'exemption, pas la présence d'un
    // identifiant d'événement. La première version liait les deux, et ça
    // cassait exactement dans le cas qui compte : une contribution dont
    // l'événement a été supprimé n'a plus de `shortId`, la demande repartait
    // en « général » et se faisait refuser au profit d'une conversation en
    // cours sur un tout autre sujet. Quelqu'un qui n'a pas été remboursé se
    // retrouvait sans aucun moyen de le signaler.
    //
    // L'événement reste une métadonnée précieuse quand on l'a — lien direct
    // côté admin, plafond par cagnotte — mais son absence ne doit jamais
    // empêcher un signalement.
    const wantsPool = askedCategory === "pool" || Boolean(eventShortId);
    let category = wantsPool ? "pool" : "general";
    let relatedEvent = null;

    if (wantsPool && eventShortId) {
      const event = await Event.findOne({ shortId: String(eventShortId) })
        .select("_id title shortId")
        .lean();
      if (!event) {
        return res.status(404).json({ message: "Événement introuvable." });
      }

      // On n'ouvre un ticket de cagnotte que pour quelqu'un qui y a
      // effectivement versé de l'argent : sans ce contrôle, la dérogation à la
      // règle du ticket unique deviendrait un moyen d'en ouvrir autant qu'on
      // veut en citant n'importe quel événement.
      const hasContributed = await GiftPoolContribution.exists({
        event: event._id,
        contributor: req.payload._id,
        status: { $in: ["succeeded", "refunded"] },
      });
      if (!hasContributed) {
        return res.status(403).json({
          code: "NOT_A_CONTRIBUTOR",
          message:
            "Aucune contribution de votre part n'est enregistrée sur cette cagnotte.",
        });
      }

      const openForEvent = await SupportMessage.findOne({
        userId: req.payload._id,
        relatedEvent: event._id,
        status: { $ne: "closed" },
      });
      if (openForEvent) {
        return res.status(409).json({
          code: "POOL_TICKET_EXISTS",
          message: `Vous avez déjà une conversation en cours au sujet de « ${event.title} ».`,
          ticket: openForEvent,
        });
      }

      relatedEvent = event._id;
    } else if (wantsPool) {
      // Litige de cagnotte sans événement identifiable : contribution faite
      // sans compte, ou événement supprimé depuis. On l'accepte — c'est
      // précisément la situation la plus difficile pour l'utilisateur — mais
      // on plafonne à un seul fil ouvert de ce type, faute de cagnotte sur
      // laquelle s'appuyer pour compter.
      const orphan = await SupportMessage.findOne({
        userId: req.payload._id,
        category: "pool",
        relatedEvent: null,
        status: { $ne: "closed" },
      });
      if (orphan) {
        return res.status(409).json({
          code: "POOL_TICKET_EXISTS",
          message:
            "Vous avez déjà une conversation en cours au sujet d'une cagnotte. " +
            "Poursuivez-la plutôt que d'en ouvrir une seconde.",
          ticket: orphan,
        });
      }
    } else {
      // Cas général : un seul ticket actif à la fois. Ça garde une vraie
      // conversation plutôt que plusieurs fils parallèles. Le front redirige
      // normalement vers ce fil avant d'arriver ici (voir ContactPage) ; ce
      // garde-fou couvre la course possible.
      //
      // ⚠️ Les tickets de cagnotte sont exclus du décompte : sinon un litige
      // d'argent en cours interdirait toute autre question, ce qui ferait
      // réapparaître le problème dans l'autre sens.
      const existing = await SupportMessage.findOne({
        userId: req.payload._id,
        status: { $ne: "closed" },
        category: { $ne: "pool" },
      });
      if (existing) {
        return res.status(409).json({
          message: "Tu as déjà une conversation en cours avec le support.",
          ticket: existing,
        });
      }
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
      category,
      relatedEvent,
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
