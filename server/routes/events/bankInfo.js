const express = require("express");
const router = express.Router();
const Event = require("../../models/event.model");
const OrganizerBankInfo = require("../../models/organizerBankInfo.model");
const { isAuthenticated } = require("../../middleware/jwt.middleware");
const { encrypt, decrypt } = require("../../utils/bankCrypto");

// Durées autorisées pour l'expiration (en jours) — garde-fou
const ALLOWED_DURATIONS = [7, 14, 30, 60, 90];

// Helper : émet la mise à jour temps réel sur la room de l'événement
const emitTransferUpdate = (req, event) => {
  const io = req.app.get("io");
  if (io) {
    io.to(`event:${event.shortId}`).emit("event:transfer_update", {
      shortId: event.shortId,
    });
  }
};

/*
 * GET /api/events/:shortId/bank-info/exists
 * Indique juste si un RIB existe, SANS déchiffrer ni renvoyer l'IBAN.
 * Même contrôle d'accès que le GET complet (compte obligatoire).
 * ⚠️ Déclarée AVANT /:shortId/bank-info pour éviter toute ambiguïté de matching.
 */
router.get("/:shortId/bank-info/exists", isAuthenticated, async (req, res) => {
  try {
    const event = await Event.findOne({ shortId: req.params.shortId });
    if (!event)
      return res.status(404).json({ message: "Événement introuvable" });

    const isOrganizer = event.organizer.toString() === req.payload._id;
    let hasAccess = isOrganizer;
    if (!hasAccess) {
      const EventInvitation = require("../../models/eventInvitation.model");
      const invitation = await EventInvitation.findOne({
        event: event._id,
        user: req.payload._id,
      });
      hasAccess = !!invitation;
    }
    if (!hasAccess) {
      return res.status(403).json({ message: "Accès non autorisé." });
    }

    const exists = await OrganizerBankInfo.exists({ event: event._id });
    res.status(200).json({ exists: !!exists });
  } catch (error) {
    console.error("❌ Error checking bank info existence:", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

/*
 * PUT /api/events/:shortId/bank-info
 * Enregistre / met à jour le RIB de l'organisateur (chiffré) + expiration.
 * Organizer only.
 * Body: { iban, holderName, durationDays }
 */
router.put("/:shortId/bank-info", isAuthenticated, async (req, res) => {
  try {
    const event = await Event.findOne({ shortId: req.params.shortId });
    if (!event)
      return res.status(404).json({ message: "Événement introuvable" });
    if (event.organizer.toString() !== req.payload._id)
      return res.status(403).json({ message: "Non autorisé" });

    const { iban, holderName, durationDays } = req.body;

    if (!iban || typeof iban !== "string" || iban.trim().length < 14) {
      return res.status(400).json({ message: "IBAN invalide." });
    }

    const days = Number(durationDays);
    if (!ALLOWED_DURATIONS.includes(days)) {
      return res.status(400).json({ message: "Durée invalide." });
    }

    const cleanIban = iban.replace(/\s+/g, "").toUpperCase();
    const { encrypted, iv, authTag } = encrypt(cleanIban);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + days);

    const bankInfo = await OrganizerBankInfo.findOneAndUpdate(
      { event: event._id },
      {
        event: event._id,
        organizer: req.payload._id,
        ibanEncrypted: encrypted,
        iv,
        authTag,
        holderName: holderName || "",
        expiresAt,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    emitTransferUpdate(req, event);

    res.status(200).json({
      saved: true,
      expiresAt: bankInfo.expiresAt,
      holderName: bankInfo.holderName,
    });
  } catch (error) {
    console.error("❌ Error saving bank info:", error);
    res.status(500).json({ message: "Erreur lors de l'enregistrement du RIB" });
  }
});

/*
 * GET /api/events/:shortId/bank-info
 * Renvoie le RIB déchiffré.
 * ⚠️ ACCÈS STRICT : utilisateur CONNECTÉ (compte BirthReminder) uniquement.
 */
router.get("/:shortId/bank-info", isAuthenticated, async (req, res) => {
  try {
    const event = await Event.findOne({ shortId: req.params.shortId });
    if (!event)
      return res.status(404).json({ message: "Événement introuvable" });

    const isOrganizer = event.organizer.toString() === req.payload._id;
    let hasAccess = isOrganizer;
    if (!hasAccess) {
      const EventInvitation = require("../../models/eventInvitation.model");
      const invitation = await EventInvitation.findOne({
        event: event._id,
        user: req.payload._id,
      });
      hasAccess = !!invitation;
    }
    if (!hasAccess) {
      return res.status(403).json({ message: "Accès non autorisé." });
    }

    const bankInfo = await OrganizerBankInfo.findOne({ event: event._id });
    if (!bankInfo) {
      return res.status(200).json({ exists: false });
    }

    const iban = decrypt({
      encrypted: bankInfo.ibanEncrypted,
      iv: bankInfo.iv,
      authTag: bankInfo.authTag,
    });

    res.status(200).json({
      exists: true,
      iban,
      holderName: bankInfo.holderName,
      expiresAt: bankInfo.expiresAt,
      isOrganizer,
    });
  } catch (error) {
    console.error("❌ Error fetching bank info:", error);
    res.status(500).json({ message: "Erreur lors de la récupération du RIB" });
  }
});

/*
 * DELETE /api/events/:shortId/bank-info
 * Suppression manuelle anticipée par l'organisateur.
 * Organizer only.
 */
router.delete("/:shortId/bank-info", isAuthenticated, async (req, res) => {
  try {
    const event = await Event.findOne({ shortId: req.params.shortId });
    if (!event)
      return res.status(404).json({ message: "Événement introuvable" });
    if (event.organizer.toString() !== req.payload._id)
      return res.status(403).json({ message: "Non autorisé" });

    await OrganizerBankInfo.deleteOne({ event: event._id });

    emitTransferUpdate(req, event);

    res.status(200).json({ deleted: true });
  } catch (error) {
    console.error("❌ Error deleting bank info:", error);
    res.status(500).json({ message: "Erreur lors de la suppression du RIB" });
  }
});

/*
 * PUT /api/events/:shortId/direct-transfer/iban-toggle
 * Active/désactive l'option virement IBAN (organizer only).
 * Body: { enabled }
 */
router.put(
  "/:shortId/direct-transfer/iban-toggle",
  isAuthenticated,
  async (req, res) => {
    try {
      const event = await Event.findOne({ shortId: req.params.shortId });
      if (!event)
        return res.status(404).json({ message: "Événement introuvable" });
      if (event.organizer.toString() !== req.payload._id)
        return res.status(403).json({ message: "Non autorisé" });

      const enabled = req.body.enabled === true;
      event.directTransfer = {
        ...(event.directTransfer || {}),
        ibanEnabled: enabled,
      };
      await event.save();

      // Si on désactive, on supprime aussi le RIB stocké (cohérence)
      if (!enabled) {
        await OrganizerBankInfo.deleteOne({ event: event._id });
      }

      emitTransferUpdate(req, event);

      res.status(200).json({ ibanEnabled: enabled });
    } catch (error) {
      console.error("❌ Error toggling IBAN option:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  },
);

/*
 * PUT /api/events/:shortId/direct-transfer/paypal
 * Active/désactive PayPal + enregistre le lien PayPal.Me (organizer only).
 * Le lien est OPTIONNEL : on peut activer sans lien (message d'attente).
 * Body: { enabled, paypalLink }
 */
router.put(
  "/:shortId/direct-transfer/paypal",
  isAuthenticated,
  async (req, res) => {
    try {
      const event = await Event.findOne({ shortId: req.params.shortId });
      if (!event)
        return res.status(404).json({ message: "Événement introuvable" });
      if (event.organizer.toString() !== req.payload._id)
        return res.status(403).json({ message: "Non autorisé" });

      const enabled = req.body.enabled === true;
      let paypalLink = (req.body.paypalLink || "").trim();

      // Le lien est optionnel : on valide seulement s'il est fourni
      if (paypalLink) {
        const ok =
          /^https?:\/\/(www\.)?paypal\.(me|com)\//i.test(paypalLink) ||
          /^(www\.)?paypal\.me\//i.test(paypalLink);
        if (!ok) {
          return res.status(400).json({
            message:
              "Lien PayPal invalide (ex : https://paypal.me/votrepseudo).",
          });
        }
        if (!/^https?:\/\//i.test(paypalLink)) {
          paypalLink = "https://" + paypalLink;
        }
      }

      // Si on désactive, on vide le lien
      if (!enabled) {
        paypalLink = "";
      }

      event.directTransfer = {
        ...(event.directTransfer || {}),
        paypalEnabled: enabled,
        paypalLink,
      };
      await event.save();

      emitTransferUpdate(req, event);

      res.status(200).json({
        paypalEnabled: enabled,
        paypalLink,
      });
    } catch (error) {
      console.error("❌ Error updating PayPal option:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  },
);

module.exports = router;
