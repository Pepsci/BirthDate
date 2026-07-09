const express = require("express");
const router = express.Router();
const User = require("../models/user.model");
const { isAuthenticated } = require("../middleware/jwt.middleware");
const { sendSupportEmail } = require("../services/emailTemplates/supportEmail");

// POST /api/support -> envoie un message au support (utilisateur connecté)
router.post("/", isAuthenticated, async (req, res) => {
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
    res.status(200).json({ success: true });
  } catch (error) {
    console.error("❌ Support email error:", error);
    res.status(500).json({ message: "Erreur lors de l'envoi du message" });
  }
});

// POST /api/support/public -> formulaire de contact public (sans compte)
router.post("/public", async (req, res) => {
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
    res.status(200).json({ success: true });
  } catch (error) {
    console.error("❌ Support public email error:", error);
    res.status(500).json({ message: "Erreur lors de l'envoi du message" });
  }
});

module.exports = router;
