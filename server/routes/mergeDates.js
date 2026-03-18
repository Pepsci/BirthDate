// routes/mergeDates.js
const express = require("express");
const router = express.Router();
const DateModel = require("../models/date.model");
const WishlistModel = require("../models/wishlist.model");
const mongoose = require("mongoose");
const { isAuthenticated } = require("../middleware/jwt.middleware");

// ========================================
// GET - Détecter les doublons potentiels pour un utilisateur
// ========================================
router.get("/detect/:userId", isAuthenticated, async (req, res) => {
  try {
    const userId = req.payload._id;

    if (!mongoose.isValidObjectId(userId)) {
      return res.status(400).json({ message: "User ID invalide" });
    }

    // Récupérer toutes les dates de l'utilisateur
    const allDates = await DateModel.find({ owner: userId }).sort({ name: 1 });

    // Grouper par nom+prénom pour détecter les doublons
    const grouped = {};

    for (const date of allDates) {
      const key = `${date.name.toLowerCase()}_${(date.surname || "").toLowerCase()}`;

      if (!grouped[key]) {
        grouped[key] = [];
      }

      grouped[key].push(date);
    }

    // Ne garder que les groupes avec au moins 2 cartes
    const duplicates = Object.values(grouped).filter(
      (group) => group.length >= 2,
    );

    // Pour chaque groupe de doublons, identifier la carte ami (avec linkedUser) et la manuelle
    const duplicatesWithDetails = await Promise.all(
      duplicates.map(async (group) => {
        const friendCard = group.find((d) => d.linkedUser);
        const manualCards = group.filter((d) => !d.linkedUser);

        // Si pas de carte ami, on ne peut pas fusionner automatiquement
        if (!friendCard) {
          return {
            canMerge: false,
            reason: "Aucune carte liée à un ami",
            cards: group.map((d) => ({
              _id: d._id,
              name: d.name,
              surname: d.surname,
              date: d.date,
              linkedUser: d.linkedUser,
              giftsCount: d.gifts?.length || 0,
              commentsCount: d.comment?.length || 0,
            })),
          };
        }

        // Récupérer la wishlist de l'ami si elle existe
        let wishlist = [];
        if (friendCard.linkedUser) {
          wishlist = await WishlistModel.find({
            userId: friendCard.linkedUser,
            isShared: true,
          });
        }

        return {
          canMerge: true,
          friendCard: {
            _id: friendCard._id,
            name: friendCard.name,
            surname: friendCard.surname,
            date: friendCard.date,
            linkedUser: friendCard.linkedUser,
            gifts: friendCard.gifts || [],
            comments: friendCard.comment || [],
            notificationPreferences: friendCard.notificationPreferences,
            receiveNotifications: friendCard.receiveNotifications,
            wishlist: wishlist,
          },
          manualCards: manualCards.map((d) => ({
            _id: d._id,
            name: d.name,
            surname: d.surname,
            date: d.date,
            gifts: d.gifts || [],
            comments: d.comment || [],
            notificationPreferences: d.notificationPreferences,
            receiveNotifications: d.receiveNotifications,
          })),
        };
      }),
    );

    // Filtrer pour ne garder que ceux qui peuvent être fusionnés
    const mergeableDuplicates = duplicatesWithDetails.filter((d) => d.canMerge);

    res.status(200).json({
      total: mergeableDuplicates.length,
      duplicates: mergeableDuplicates,
    });
  } catch (error) {
    console.error("Erreur détection doublons:", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// ========================================
// POST - Fusionner une carte manuelle vers une carte ami
// ========================================
router.post("/merge", isAuthenticated, async (req, res) => {
  try {
    const { friendCardId, manualCardId } = req.body;
    const userId = req.payload._id;

    if (
      !mongoose.isValidObjectId(friendCardId) ||
      !mongoose.isValidObjectId(manualCardId)
    ) {
      return res.status(400).json({ message: "IDs invalides" });
    }

    // Récupérer les deux cartes
    const friendCard = await DateModel.findOne({
      _id: friendCardId,
      owner: userId,
    });
    const manualCard = await DateModel.findOne({
      _id: manualCardId,
      owner: userId,
    });

    if (!friendCard || !manualCard) {
      return res.status(404).json({ message: "Cartes non trouvées" });
    }

    // Vérifier que friendCard est bien une carte ami
    if (!friendCard.linkedUser) {
      return res.status(400).json({
        message:
          "La carte de destination doit être une carte ami (avec linkedUser)",
      });
    }

    // Vérifier que manualCard est bien une carte manuelle
    if (manualCard.linkedUser) {
      return res.status(400).json({
        message: "La carte source ne doit pas être une carte ami",
      });
    }

    console.log(
      `🔄 Fusion: ${manualCard.name} (manuel) → ${friendCard.name} (ami)`,
    );

    // 1️⃣ Fusionner les gifts (idées cadeaux)
    const existingGiftNames = new Set(
      friendCard.gifts.map((g) => g.giftName.toLowerCase()),
    );

    const newGifts = manualCard.gifts.filter(
      (g) => !existingGiftNames.has(g.giftName.toLowerCase()),
    );

    if (newGifts.length > 0) {
      friendCard.gifts.push(...newGifts);
      console.log(`✅ ${newGifts.length} idées cadeaux ajoutées`);
    }

    // 2️⃣ Fusionner les commentaires
    if (manualCard.comment && manualCard.comment.length > 0) {
      friendCard.comment.push(...manualCard.comment);
      console.log(`✅ ${manualCard.comment.length} commentaires ajoutés`);
    }

    // 3️⃣ Garder les préférences de notification les plus permissives
    if (manualCard.receiveNotifications && !friendCard.receiveNotifications) {
      friendCard.receiveNotifications = true;
      console.log(`✅ Notifications réactivées`);
    }

    // Fusionner les timings de notification (garder l'union)
    if (manualCard.notificationPreferences?.timings) {
      const allTimings = new Set([
        ...friendCard.notificationPreferences.timings,
        ...manualCard.notificationPreferences.timings,
      ]);
      friendCard.notificationPreferences.timings = Array.from(allTimings);
    }

    // 4️⃣ Sauvegarder la carte ami fusionnée
    await friendCard.save();

    // 5️⃣ Supprimer la carte manuelle
    await DateModel.findByIdAndDelete(manualCardId);

    console.log(`✅ Fusion terminée, carte manuelle supprimée`);

    res.status(200).json({
      message: "Fusion réussie",
      mergedCard: {
        _id: friendCard._id,
        name: friendCard.name,
        surname: friendCard.surname,
        giftsCount: friendCard.gifts.length,
        commentsCount: friendCard.comment.length,
      },
      details: {
        giftsAdded: newGifts.length,
        commentsAdded: manualCard.comment?.length || 0,
      },
    });
  } catch (error) {
    console.error("Erreur fusion:", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// ========================================
// POST - Fusionner TOUTES les cartes détectées pour un utilisateur
// ========================================
router.post("/merge-all/:userId", isAuthenticated, async (req, res) => {
  try {
    const userId = req.payload._id;

    if (!mongoose.isValidObjectId(userId)) {
      return res.status(400).json({ message: "User ID invalide" });
    }

    // Détecter les doublons
    const detectionResponse = await detectDuplicatesForUser(userId);
    const duplicates = detectionResponse.filter((d) => d.canMerge);

    let mergedCount = 0;
    let errorCount = 0;
    const results = [];

    for (const duplicate of duplicates) {
      for (const manualCard of duplicate.manualCards) {
        try {
          // Fusionner chaque carte manuelle vers la carte ami
          const friendCard = await DateModel.findById(duplicate.friendCard._id);
          const manual = await DateModel.findById(manualCard._id);

          if (!friendCard || !manual) continue;

          // Ajouter les gifts
          const existingGiftNames = new Set(
            friendCard.gifts.map((g) => g.giftName.toLowerCase()),
          );

          const newGifts = manual.gifts.filter(
            (g) => !existingGiftNames.has(g.giftName.toLowerCase()),
          );

          if (newGifts.length > 0) {
            friendCard.gifts.push(...newGifts);
          }

          // Ajouter les commentaires
          if (manual.comment && manual.comment.length > 0) {
            friendCard.comment.push(...manual.comment);
          }

          await friendCard.save();
          await DateModel.findByIdAndDelete(manualCard._id);

          mergedCount++;
          results.push({
            success: true,
            name: `${friendCard.name} ${friendCard.surname}`,
            giftsAdded: newGifts.length,
          });
        } catch (error) {
          errorCount++;
          results.push({
            success: false,
            name: `${manualCard.name} ${manualCard.surname}`,
            error: "Erreur lors de la fusion",
          });
        }
      }
    }

    res.status(200).json({
      message: "Fusion globale terminée",
      mergedCount,
      errorCount,
      results,
    });
  } catch (error) {
    console.error("Erreur fusion globale:", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// Fonction helper pour détecter les doublons (réutilisée par merge-all)
async function detectDuplicatesForUser(userId) {
  const allDates = await DateModel.find({ owner: userId }).sort({ name: 1 });

  const grouped = {};
  for (const date of allDates) {
    const key = `${date.name.toLowerCase()}_${(date.surname || "").toLowerCase()}`;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(date);
  }

  const duplicates = Object.values(grouped).filter(
    (group) => group.length >= 2,
  );

  return await Promise.all(
    duplicates.map(async (group) => {
      const friendCard = group.find((d) => d.linkedUser);
      const manualCards = group.filter((d) => !d.linkedUser);

      if (!friendCard) {
        return { canMerge: false, cards: group };
      }

      let wishlist = [];
      if (friendCard.linkedUser) {
        wishlist = await WishlistModel.find({
          userId: friendCard.linkedUser,
          isShared: true,
        });
      }

      return {
        canMerge: true,
        friendCard: {
          _id: friendCard._id,
          name: friendCard.name,
          surname: friendCard.surname,
          linkedUser: friendCard.linkedUser,
          gifts: friendCard.gifts || [],
          wishlist: wishlist,
        },
        manualCards: manualCards.map((d) => ({
          _id: d._id,
          name: d.name,
          surname: d.surname,
          gifts: d.gifts || [],
        })),
      };
    }),
  );
}

module.exports = router;
