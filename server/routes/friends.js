const express = require("express");
const router = express.Router();
const Friend = require("../models/friend.model");
const User = require("../models/user.model");
const DateModel = require("../models/date.model");
const mongoose = require("mongoose");
const { isAuthenticated } = require("../middleware/jwt.middleware");
const {
  sendFriendRequestNotification,
} = require("../services/emailTemplates/friendRequestEmailService");

// ========================================
// GET - Obtenir tous les amis d'un utilisateur
// ========================================
router.get("/", isAuthenticated, async (req, res) => {
  try {
    // Récupérer l'userId depuis le JWT
    const userId = req.payload._id;

    if (!userId || !mongoose.isValidObjectId(userId)) {
      return res.status(400).json({ message: "User ID invalide" });
    }

    const friends = await Friend.getFriends(userId);

    res.status(200).json(friends);
  } catch (error) {
    console.error("Erreur lors de la récupération des amis:", error);
    res.status(500).json({ message: "Erreur serveur", error: error.message });
  }
});

// ========================================
// GET - Obtenir les demandes d'amitié en attente
// ========================================
router.get("/requests", isAuthenticated, async (req, res) => {
  try {
    // Récupérer l'userId depuis le JWT
    const userId = req.payload._id;

    if (!userId || !mongoose.isValidObjectId(userId)) {
      return res.status(400).json({ message: "User ID invalide" });
    }

    const requests = await Friend.getPendingRequests(userId);

    res.status(200).json(requests);
  } catch (error) {
    console.error("Erreur lors de la récupération des demandes:", error);
    res.status(500).json({ message: "Erreur serveur", error: error.message });
  }
});

// ========================================
// GET - Obtenir les demandes d'amitié envoyées
// ========================================
router.get("/sent", isAuthenticated, async (req, res) => {
  try {
    // Récupérer l'userId depuis le JWT
    const userId = req.payload._id;

    if (!userId || !mongoose.isValidObjectId(userId)) {
      return res.status(400).json({ message: "User ID invalide" });
    }

    const sentRequests = await Friend.find({
      user: userId,
      status: "pending",
    })
      .populate("friend", "name email avatar birthDate")
      .populate("requestedBy", "name email avatar");

    res.status(200).json(sentRequests);
  } catch (error) {
    console.error("Erreur:", error);
    res.status(500).json({ message: "Erreur serveur", error: error.message });
  }
});

// ========================================
// POST - Envoyer une demande d'amitié par email
// ========================================
router.post("/request", async (req, res) => {
  try {
    const { userId, friendEmail } = req.body;

    if (!userId || !friendEmail) {
      return res.status(400).json({ message: "userId et friendEmail requis" });
    }

    if (!mongoose.isValidObjectId(userId)) {
      return res.status(400).json({ message: "User ID invalide" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "Utilisateur non trouvé" });
    }

    const friend = await User.findOne({ email: friendEmail });

    if (!friend) {
      return res.status(404).json({
        message: "Aucun utilisateur trouvé avec cet email",
        suggestion: "Invitez-le à rejoindre BirthReminder !",
      });
    }

    if (userId === friend._id.toString()) {
      return res
        .status(400)
        .json({ message: "Vous ne pouvez pas vous ajouter vous-même" });
    }

    const existingFriendship = await Friend.findOne({
      $or: [
        { user: userId, friend: friend._id },
        { user: friend._id, friend: userId },
      ],
    });

    if (existingFriendship) {
      if (existingFriendship.status === "accepted") {
        return res
          .status(400)
          .json({ message: "Vous êtes déjà amis avec cette personne" });
      } else if (existingFriendship.status === "pending") {
        return res
          .status(400)
          .json({ message: "Une demande d'amitié est déjà en attente" });
      } else if (existingFriendship.status === "rejected") {
        existingFriendship.status = "pending";
        existingFriendship.requestedBy = userId;
        existingFriendship.requestedAt = Date.now();
        await existingFriendship.save();

        return res.status(200).json({
          message: "Demande d'amitié renvoyée",
          friendship: existingFriendship,
        });
      }
    }

    const newFriendship = await Friend.create({
      user: userId,
      friend: friend._id,
      requestedBy: userId,
      status: "pending",
    });

    // 🆕 NOUVEAU : Envoyer l'email de notification
    try {
      // Vérifier si le destinataire veut recevoir des emails de demandes d'ami
      const shouldReceiveEmail = friend.receiveFriendRequestEmails !== false;

      if (shouldReceiveEmail && friend.email) {
        console.log(`📧 Envoi email de demande d'ami à ${friend.email}`);

        const emailResult = await sendFriendRequestNotification(
          friend.email,
          user.name,
          friend._id.toString(),
        );

        if (emailResult.success) {
          console.log("✅ Email envoyé avec succès");
        } else {
          console.log("⚠️ Email non envoyé:", emailResult.error);
        }
      } else {
        console.log(
          `🔕 Email non envoyé : ${friend.name} a désactivé les notifications de demandes d'amis`,
        );
      }
    } catch (emailError) {
      // Logger l'erreur mais ne pas faire échouer la requête
      console.error(
        "❌ Erreur lors de l'envoi de l'email de notification:",
        emailError,
      );
    }

    const populatedFriendship = await Friend.findById(newFriendship._id)
      .populate("user", "name email")
      .populate("friend", "name email");

    res.status(201).json({
      message: "Demande d'amitié envoyée",
      friendship: populatedFriendship,
    });
  } catch (error) {
    console.error("Erreur lors de l'envoi de la demande:", error);
    res.status(500).json({ message: "Erreur serveur", error: error.message });
  }
});

// ========================================
// PATCH - Accepter une demande d'amitié
// MODIFIÉ pour créer automatiquement une date POUR LES DEUX
// ========================================
router.patch("/:friendshipId/accept", async (req, res) => {
  try {
    const { friendshipId } = req.params;
    const { userId } = req.body;

    if (!mongoose.isValidObjectId(friendshipId)) {
      return res.status(400).json({ message: "Friendship ID invalide" });
    }

    const friendship = await Friend.findById(friendshipId);

    if (!friendship) {
      return res.status(404).json({ message: "Demande non trouvée" });
    }

    // Vérifier que c'est bien le destinataire qui accepte
    if (friendship.friend.toString() !== userId) {
      return res
        .status(403)
        .json({ message: "Vous ne pouvez pas accepter cette demande" });
    }

    if (friendship.status !== "pending") {
      return res
        .status(400)
        .json({ message: "Cette demande n'est plus en attente" });
    }

    friendship.status = "accepted";
    friendship.acceptedAt = Date.now();
    await friendship.save();

    // 👇 MODIFIÉ : Créer une date pour CHAQUE utilisateur
    try {
      // Récupérer les infos des DEUX utilisateurs
      const user1 = await User.findById(friendship.user); // Celui qui a envoyé
      const user2 = await User.findById(friendship.friend); // Celui qui accepte

      // 1️⃣ Créer une date pour user2 (celui qui accepte) avec les infos de user1
      if (user1 && user1.birthDate) {
        const existingDate1 = await DateModel.findOne({
          owner: user2._id,
          linkedUser: user1._id,
        });

        if (!existingDate1) {
          await DateModel.create({
            date: user1.birthDate,
            name: user1.name,
            surname: user1.surname || "",
            owner: user2._id, // user2 possède cette date
            linkedUser: user1._id, // Lien vers user1
            family: false,
            receiveNotifications: true,
            notificationPreferences: {
              timings: [1],
              notifyOnBirthday: true,
            },
            comment: [],
            gifts: [],
          });
          console.log(`✅ Date créée pour ${user2.name} (ami: ${user1.name})`);
        }
      }

      // 2️⃣ Créer une date pour user1 (celui qui a envoyé) avec les infos de user2
      if (user2 && user2.birthDate) {
        const existingDate2 = await DateModel.findOne({
          owner: user1._id,
          linkedUser: user2._id,
        });

        if (!existingDate2) {
          await DateModel.create({
            date: user2.birthDate,
            name: user2.name,
            surname: user2.surname || "",
            owner: user1._id, // user1 possède cette date
            linkedUser: user2._id, // Lien vers user2
            family: false,
            receiveNotifications: true,
            notificationPreferences: {
              timings: [1],
              notifyOnBirthday: true,
            },
            comment: [],
            gifts: [],
          });
          console.log(`✅ Date créée pour ${user1.name} (ami: ${user2.name})`);
        }
      }
    } catch (error) {
      console.error("Erreur création dates automatiques:", error);
      // On continue même si la création de dates échoue
    }

    const populatedFriendship = await Friend.findById(friendship._id)
      .populate("user", "name email avatar")
      .populate("friend", "name email avatar");

    res.status(200).json({
      message: "Demande d'amitié acceptée",
      friendship: populatedFriendship,
    });
  } catch (error) {
    console.error("Erreur lors de l'acceptation:", error);
    res.status(500).json({ message: "Erreur serveur", error: error.message });
  }
});

// ========================================
// PATCH - Refuser une demande d'amitié
// ========================================
router.patch("/:friendshipId/reject", async (req, res) => {
  try {
    const { friendshipId } = req.params;
    const { userId } = req.body;

    if (!mongoose.isValidObjectId(friendshipId)) {
      return res.status(400).json({ message: "Friendship ID invalide" });
    }

    const friendship = await Friend.findById(friendshipId);

    if (!friendship) {
      return res.status(404).json({ message: "Demande non trouvée" });
    }

    if (friendship.friend.toString() !== userId) {
      return res
        .status(403)
        .json({ message: "Vous ne pouvez pas refuser cette demande" });
    }

    friendship.status = "rejected";
    await friendship.save();

    res.status(200).json({
      message: "Demande d'amitié refusée",
      friendship,
    });
  } catch (error) {
    console.error("Erreur lors du refus:", error);
    res.status(500).json({ message: "Erreur serveur", error: error.message });
  }
});

// ========================================
// PATCH - Lier un ami à une date existante
// ========================================
router.patch("/:friendshipId/link-date", async (req, res) => {
  try {
    const { friendshipId } = req.params;
    const { dateId } = req.body;

    if (
      !mongoose.isValidObjectId(friendshipId) ||
      !mongoose.isValidObjectId(dateId)
    ) {
      return res.status(400).json({ message: "ID invalides" });
    }

    const friendship = await Friend.findById(friendshipId);

    if (!friendship) {
      return res.status(404).json({ message: "Amitié non trouvée" });
    }

    if (friendship.status !== "accepted") {
      return res.status(400).json({
        message: "L'amitié doit être acceptée pour lier une date",
      });
    }

    friendship.linkedDate = dateId;
    await friendship.save();

    const populatedFriendship = await Friend.findById(friendship._id)
      .populate("user", "name email")
      .populate("friend", "name email")
      .populate("linkedDate");

    res.status(200).json({
      message: "Date liée à l'ami",
      friendship: populatedFriendship,
    });
  } catch (error) {
    console.error("Erreur lors de la liaison:", error);
    res.status(500).json({ message: "Erreur serveur", error: error.message });
  }
});

// ========================================
// DELETE - Supprimer un ami
// CORRIGÉ pour supprimer les dates liées des DEUX côtés
// ========================================
router.delete("/:friendshipId", async (req, res) => {
  try {
    const { friendshipId } = req.params;

    if (!mongoose.isValidObjectId(friendshipId)) {
      return res.status(400).json({ message: "Friendship ID invalide" });
    }

    const friendship = await Friend.findById(friendshipId);

    if (!friendship) {
      return res.status(404).json({ message: "Amitié non trouvée" });
    }

    // 👇 CORRIGÉ : Supprimer les dates liées des DEUX côtés
    try {
      const user1Id = friendship.user;
      const user2Id = friendship.friend;

      // 1️⃣ Supprimer la date de user1 qui pointe vers user2
      const deletedDate1 = await DateModel.findOneAndDelete({
        owner: user1Id,
        linkedUser: user2Id,
      });

      if (deletedDate1) {
        console.log(`🗑️ Date supprimée pour user ${user1Id} (ami: ${user2Id})`);
      }

      // 2️⃣ Supprimer la date de user2 qui pointe vers user1
      const deletedDate2 = await DateModel.findOneAndDelete({
        owner: user2Id,
        linkedUser: user1Id,
      });

      if (deletedDate2) {
        console.log(`🗑️ Date supprimée pour user ${user2Id} (ami: ${user1Id})`);
      }

      // 3️⃣ Supprimer aussi l'ancienne date liée si elle existe (legacy)
      if (friendship.linkedDate) {
        await DateModel.findByIdAndDelete(friendship.linkedDate);
        console.log(
          `🗑️ Ancienne date liée supprimée: ${friendship.linkedDate}`,
        );
      }
    } catch (error) {
      console.error("❌ Erreur suppression dates liées:", error);
      // On continue même si la suppression de dates échoue
    }

    // 4️⃣ Supprimer la friendship
    await Friend.findByIdAndDelete(friendshipId);

    res.status(200).json({
      message: "Ami et dates associées supprimés",
      friendship,
    });
  } catch (error) {
    console.error("❌ Erreur lors de la suppression:", error);
    res.status(500).json({ message: "Erreur serveur", error: error.message });
  }
});

module.exports = router;
