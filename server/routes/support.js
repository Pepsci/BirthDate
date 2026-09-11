const express = require("express");
const router = express.Router();
const rateLimit = require("express-rate-limit");
const { ipKeyGenerator } = require("express-rate-limit");
const User = require("../models/user.model");
const Log = require("../models/log.model");
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

// POST /api/support -> envoie un message au support (utilisateur connecté)
router.post("/", isAuthenticated, supportLimiter, async (req, res) => {
  try {
    const { subject, message } = req.body;
    if (!subject || !subject.trim()) {
      return res.status(400).json({ message: "L'objet est requis" });
    }
    if (!message || !message.trim()) {
      return res.status(400).json({ message: "Le message est requis" });
    }
    const user = await User.findById(req.payload._id).select(
      "name surname email",
    );
    await sendSupportEmail({
      fromEmail: user?.email,
      fromName: user ? `${user.name} ${user.surname || ""}`.trim() : undefined,
      subject,
      message,
    });
    await logSupportMessage(req, req.payload._id);
    res.status(200).json({ success: true });
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
    await sendSupportEmail({
      fromEmail: email.trim().toLowerCase(),
      fromName: name?.trim() || "Visiteur",
      subject,
      message,
    });
    await logSupportMessage(req, null, { email: email.trim().toLowerCase() });
    res.status(200).json({ success: true });
  } catch (error) {
    console.error("❌ Support public email error:", error);
    res.status(500).json({ message: "Erreur lors de l'envoi du message" });
  }
});

module.exports = router;
