const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const { isAuthenticated } = require("../middleware/jwt.middleware");
const { isAdmin } = require("../middleware/isAdmin");
const User = require("../models/user.model");
const Report = require("../models/report.model");
const { sendSupportEmail } = require("../services/emailTemplates/supportEmail");

const REASONS = ["spam", "harassment", "inappropriate", "scam", "other"];
const CONTENT_TYPES = [
  "message",
  "eventMessage",
  "giftProposal",
  "wishlist",
  "user",
  "other",
];

/*
 * POST /api/moderation/reports
 * Body : { contentType, contentId?, targetUserId?, reason, details?, contentPreview? }
 * Crée un signalement + alerte email au support (engagement de traitement < 24 h).
 */
router.post("/reports", isAuthenticated, async (req, res) => {
  try {
    const { contentType, contentId, targetUserId, reason, details, contentPreview } =
      req.body;

    if (!CONTENT_TYPES.includes(contentType)) {
      return res.status(400).json({ message: "Type de contenu invalide" });
    }
    if (!REASONS.includes(reason)) {
      return res.status(400).json({ message: "Motif invalide" });
    }
    if (!targetUserId && !contentId) {
      return res
        .status(400)
        .json({ message: "Un contenu ou un utilisateur cible est requis" });
    }

    const report = await Report.create({
      reporter: req.payload._id,
      targetUser: mongoose.isValidObjectId(targetUserId) ? targetUserId : null,
      contentType,
      contentId: mongoose.isValidObjectId(contentId) ? contentId : null,
      contentPreview: (contentPreview || "").slice(0, 2000),
      reason,
      details: (details || "").slice(0, 2000),
    });

    // Alerte support (best effort — le signalement est déjà enregistré)
    try {
      const reporter = await User.findById(req.payload._id).select("name surname email");
      const target = report.targetUser
        ? await User.findById(report.targetUser).select("name surname email")
        : null;
      await sendSupportEmail({
        fromEmail: reporter?.email,
        fromName: reporter ? `${reporter.name} ${reporter.surname || ""}`.trim() : "Utilisateur",
        subject: `🚨 SIGNALEMENT [${reason}] ${contentType} — report ${report._id}`,
        message:
          `Signalement à traiter sous 24 h.\n\n` +
          `Type : ${contentType}\nMotif : ${reason}\n` +
          `Cible : ${target ? `${target.name} (${target.email}) — ${target._id}` : targetUserId || "n/a"}\n` +
          `Contenu (id) : ${contentId || "n/a"}\n` +
          `Extrait : ${(contentPreview || "").slice(0, 500) || "n/a"}\n` +
          `Détails : ${details || "n/a"}`,
      });
    } catch (mailErr) {
      console.error("⚠️ Report alert email failed:", mailErr);
    }

    res.status(201).json({ success: true, reportId: report._id });
  } catch (error) {
    console.error("❌ Error creating report:", error);
    res.status(500).json({ message: "Erreur lors du signalement" });
  }
});

/*
 * GET /api/moderation/blocked -> liste des utilisateurs bloqués
 */
router.get("/blocked", isAuthenticated, async (req, res) => {
  try {
    const me = await User.findById(req.payload._id)
      .select("blockedUsers")
      .populate("blockedUsers", "name surname avatar email");
    res.json(me?.blockedUsers || []);
  } catch (error) {
    console.error("❌ Error fetching blocked users:", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

/*
 * POST /api/moderation/block/:userId -> bloquer un utilisateur
 */
router.post("/block/:userId", isAuthenticated, async (req, res) => {
  try {
    const { userId } = req.params;
    if (!mongoose.isValidObjectId(userId)) {
      return res.status(400).json({ message: "Identifiant invalide" });
    }
    if (userId === String(req.payload._id)) {
      return res.status(400).json({ message: "Impossible de se bloquer soi-même" });
    }
    await User.findByIdAndUpdate(req.payload._id, {
      $addToSet: { blockedUsers: userId },
    });
    res.json({ success: true });
  } catch (error) {
    console.error("❌ Error blocking user:", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

/*
 * DELETE /api/moderation/block/:userId -> débloquer
 */
router.delete("/block/:userId", isAuthenticated, async (req, res) => {
  try {
    const { userId } = req.params;
    if (!mongoose.isValidObjectId(userId)) {
      return res.status(400).json({ message: "Identifiant invalide" });
    }
    await User.findByIdAndUpdate(req.payload._id, {
      $pull: { blockedUsers: userId },
    });
    res.json({ success: true });
  } catch (error) {
    console.error("❌ Error unblocking user:", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

/*
 * GET /api/moderation/reports -> liste admin (traitement des signalements)
 */
router.get("/reports", isAuthenticated, isAdmin, async (req, res) => {
  try {
    const { status } = req.query;
    const query = status ? { status } : {};
    const reports = await Report.find(query)
      .populate("reporter", "name surname email")
      .populate("targetUser", "name surname email")
      .sort({ createdAt: -1 })
      .limit(200);
    res.json(reports);
  } catch (error) {
    console.error("❌ Error fetching reports:", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

/*
 * PUT /api/moderation/reports/:reportId -> admin : changer le statut
 */
router.put("/reports/:reportId", isAuthenticated, isAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    if (!["pending", "reviewed", "actioned", "dismissed"].includes(status)) {
      return res.status(400).json({ message: "Statut invalide" });
    }
    const report = await Report.findByIdAndUpdate(
      req.params.reportId,
      { status, reviewedBy: req.payload._id, reviewedAt: new Date() },
      { new: true },
    );
    if (!report) return res.status(404).json({ message: "Signalement introuvable" });
    res.json(report);
  } catch (error) {
    console.error("❌ Error updating report:", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

module.exports = router;
