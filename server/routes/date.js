const express = require("express");
const router = express.Router();
const dateModel = require("./../models/date.model");
const mongoose = require("mongoose");
const userModel = require("../models/user.model");

// 👇 CORRIGÉ : middleware au lieu de middlewares
const { isAuthenticated } = require("../middleware/jwt.middleware");

// ========================================
// GET / - Liste des dates
// 🔒 SÉCURISÉ : Ne renvoie QUE les dates de l'utilisateur connecté
// ========================================
router.get("/", isAuthenticated, async (req, res, next) => {
  try {
    // ✅ Utiliser UNIQUEMENT l'ID de l'utilisateur authentifié
    // Ignorer complètement req.query.owner
    const userId = req.payload._id; // Depuis le middleware JWT

    const dateList = await dateModel
      .find({ owner: userId })
      .populate("owner")
      .populate("linkedUser", "name surname email avatar birthDate");

    res.status(200).json(dateList);
  } catch (error) {
    console.error("Error fetching date list:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// ========================================
// POST / - Créer une date
// 🔒 SÉCURISÉ : Force le owner à être l'utilisateur connecté
// ========================================
router.post("/", isAuthenticated, async (req, res, next) => {
  const { date, name, surname, family, linkedUser } = req.body;

  try {
    // ✅ Forcer le owner à être l'utilisateur connecté
    const newDate = await dateModel.create({
      date,
      owner: req.payload._id, // 👈 Toujours l'utilisateur connecté
      name,
      surname,
      family,
      linkedUser,
    });

    res.status(201).json(newDate);
  } catch (error) {
    console.error("Error creating date:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// ========================================
// GET /:id - Obtenir une date spécifique
// 🔒 SÉCURISÉ : Vérifie que la date appartient à l'utilisateur
// ========================================
router.get("/:id", isAuthenticated, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid Date ID" });
    }

    const date = await dateModel
      .findOne({
        _id: req.params.id,
        owner: req.payload._id, // 👈 Vérifier le propriétaire
      })
      .populate("owner")
      .populate("linkedUser", "name surname email avatar birthDate");

    if (!date) {
      return res.status(404).json({ message: "Date not found" });
    }

    res.status(200).json(date);
  } catch (error) {
    console.error("Error fetching date:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// ========================================
// PATCH /:id - Modifier une date
// 🔒 SÉCURISÉ : Vérifie le propriétaire avant modification
// ========================================
router.patch("/:id", isAuthenticated, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid Date ID" });
    }

    // Vérifier que la date appartient à l'utilisateur
    const existingDate = await dateModel.findOne({
      _id: req.params.id,
      owner: req.payload._id, // 👈 Vérification du propriétaire
    });

    if (!existingDate) {
      return res.status(404).json({ message: "Date not found" });
    }

    // Si c'est une date liée à un ami, on ne peut pas la modifier
    if (existingDate.linkedUser) {
      return res.status(403).json({
        message:
          "Impossible de modifier une date liée à un ami. Les modifications doivent se faire via le profil de l'ami.",
      });
    }

    const { date, name, surname, family, giftName, purchased } = req.body;
    const updateFields = { date, name, surname, family };

    if (giftName && purchased !== undefined) {
      updateFields.$push = { gifts: { giftName, purchased } };
    }

    const updatedDate = await dateModel.findByIdAndUpdate(
      req.params.id,
      updateFields,
      { new: true },
    );

    res.status(200).json(updatedDate);
  } catch (error) {
    console.error("Error updating date:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// ========================================
// PATCH /:id/gifts - Ajouter un cadeau
// 🔒 SÉCURISÉ
// ========================================
router.patch("/:id/gifts", isAuthenticated, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid Date ID" });
    }

    const { giftName, occasion, year, purchased } = req.body;

    // Vérifier le propriétaire avant modification
    const updatedDate = await dateModel.findOneAndUpdate(
      {
        _id: req.params.id,
        owner: req.payload._id, // 👈 Vérification du propriétaire
      },
      {
        $push: {
          gifts: {
            giftName,
            occasion,
            year,
            purchased,
          },
        },
      },
      { new: true },
    );

    if (!updatedDate) {
      return res
        .status(404)
        .json({ message: "Date not found or unauthorized" });
    }

    res.status(200).json(updatedDate);
  } catch (error) {
    console.error("Error updating date:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// ========================================
// PATCH /:id/gifts/:giftId - Modifier un cadeau
// 🔒 SÉCURISÉ
// ========================================
router.patch("/:id/gifts/:giftId", isAuthenticated, async (req, res, next) => {
  try {
    if (
      !mongoose.isValidObjectId(req.params.id) ||
      !mongoose.isValidObjectId(req.params.giftId)
    ) {
      return res.status(400).json({ message: "Invalid Date ID or Gift ID" });
    }

    const { giftName, occasion, year, purchased } = req.body;

    const updatedDate = await dateModel.findOneAndUpdate(
      {
        _id: req.params.id,
        owner: req.payload._id, // 👈 Vérification du propriétaire
        "gifts._id": req.params.giftId,
      },
      {
        $set: {
          "gifts.$.giftName": giftName,
          "gifts.$.occasion": occasion,
          "gifts.$.year": year,
          "gifts.$.purchased": purchased,
        },
      },
      { new: true },
    );

    if (!updatedDate) {
      return res
        .status(404)
        .json({ message: "Date or Gift not found or unauthorized" });
    }

    res.status(200).json(updatedDate);
  } catch (error) {
    console.error("Error updating gift:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// ========================================
// DELETE /:id/gifts/:giftId - Supprimer un cadeau
// 🔒 SÉCURISÉ
// ========================================
router.delete("/:id/gifts/:giftId", isAuthenticated, async (req, res, next) => {
  try {
    if (
      !mongoose.isValidObjectId(req.params.id) ||
      !mongoose.isValidObjectId(req.params.giftId)
    ) {
      return res.status(400).json({ message: "Invalid Date ID or Gift ID" });
    }

    const updatedDate = await dateModel.findOneAndUpdate(
      {
        _id: req.params.id,
        owner: req.payload._id, // 👈 Vérification du propriétaire
      },
      { $pull: { gifts: { _id: req.params.giftId } } },
      { new: true },
    );

    if (!updatedDate) {
      return res
        .status(404)
        .json({ message: "Date or Gift not found or unauthorized" });
    }

    res.status(200).json(updatedDate);
  } catch (error) {
    console.error("Error deleting gift:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// ========================================
// DELETE /:id - Supprimer une date
// 🔒 SÉCURISÉ
// ========================================
router.delete("/:id", isAuthenticated, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid Date ID" });
    }

    const existingDate = await dateModel.findOne({
      _id: req.params.id,
      owner: req.payload._id, // 👈 Vérification du propriétaire
    });

    if (!existingDate) {
      return res
        .status(404)
        .json({ message: "Date not found or unauthorized" });
    }

    if (existingDate.linkedUser) {
      return res.status(403).json({
        message:
          "Impossible de supprimer une date liée à un ami. Supprimez l'ami de votre liste d'amis pour retirer sa date.",
      });
    }

    const deleteDate = await dateModel.findByIdAndDelete(req.params.id);
    res.status(200).json(deleteDate);
  } catch (error) {
    next(error);
  }
});

// ========================================
// PUT /:id/notifications - Toggle notifications
// 🔒 SÉCURISÉ
// ========================================
router.put("/:id/notifications", isAuthenticated, async (req, res, next) => {
  try {
    const { receiveNotifications } = req.body;
    const dateId = req.params.id;

    const updatedDate = await dateModel.findOneAndUpdate(
      {
        _id: dateId,
        owner: req.payload._id, // 👈 Vérification du propriétaire
      },
      { receiveNotifications },
      { new: true },
    );

    if (!updatedDate) {
      return res
        .status(404)
        .json({ message: "Date non trouvée ou non autorisée" });
    }

    res.status(200).json(updatedDate);
  } catch (error) {
    console.error(
      "Erreur lors de la mise à jour des préférences de notification:",
      error,
    );
    res.status(500).json({ message: "Erreur serveur", error: error.message });
  }
});

// ========================================
// PUT /:id/notification-preferences - Préférences de timing
// 🔒 SÉCURISÉ
// ========================================
router.put(
  "/:id/notification-preferences",
  isAuthenticated,
  async (req, res, next) => {
    try {
      const { timings, notifyOnBirthday } = req.body;
      const dateId = req.params.id;

      const updatedDate = await dateModel.findOneAndUpdate(
        {
          _id: dateId,
          owner: req.payload._id, // 👈 Vérification du propriétaire
        },
        {
          "notificationPreferences.timings": timings,
          "notificationPreferences.notifyOnBirthday": notifyOnBirthday,
        },
        { new: true },
      );

      if (!updatedDate) {
        return res
          .status(404)
          .json({ message: "Date non trouvée ou non autorisée" });
      }

      res.status(200).json(updatedDate);
    } catch (error) {
      console.error(
        "Erreur lors de la mise à jour des préférences de timing:",
        error,
      );
      res.status(500).json({ message: "Erreur serveur", error: error.message });
    }
  },
);

module.exports = router;
