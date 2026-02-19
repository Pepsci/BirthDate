const express = require("express");
const router = express.Router();
const Friend = require("../models/friend.model");
const User = require("../models/user.model");
const DateModel = require("../models/date.model");
const Invitation = require("../models/invitation.model");
const mongoose = require("mongoose");
const { isAuthenticated } = require("../middleware/jwt.middleware");
const {
  sendFriendRequestNotification,
} = require("../services/emailTemplates/friendRequestEmailService");
const {
  sendInvitationEmail,
} = require("../services/emailTemplates/invitationEmail");
const { generateVerificationToken } = require("../services/verififcation");
const { createFriendDates } = require("../utils/friendDates"); // ✅ import utilitaire

// ========================================
// GET - Obtenir tous les amis
// ========================================
router.get("/", isAuthenticated, async (req, res) => {
  try {
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
// GET - Demandes d'amitié en attente reçues
// ========================================
router.get("/requests", isAuthenticated, async (req, res) => {
  try {
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
// GET - Demandes d'amitié envoyées
// ========================================
router.get("/sent", isAuthenticated, async (req, res) => {
  try {
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
// POST - Envoyer une demande d'amitié ou une invitation
// ========================================
router.post("/", isAuthenticated, async (req, res, next) => {
  try {
    const { email } = req.body;
    const currentUserId = req.payload._id;
    const currentUser = await User.findById(currentUserId);
    const targetUser = await User.findOne({ email });

    if (targetUser) {
      // ✅ CAS 1 : utilisateur existant → demande d'amitié classique
      if (targetUser._id.toString() === currentUserId) {
        return res
          .status(400)
          .json({ message: "Vous ne pouvez pas vous ajouter vous-même" });
      }

      const existing = await Friend.findOne({
        $or: [
          { user: currentUserId, friend: targetUser._id },
          { user: targetUser._id, friend: currentUserId },
        ],
      });

      if (existing) {
        return res
          .status(400)
          .json({ message: "Une relation existe déjà avec cet utilisateur" });
      }

      const friendship = await Friend.create({
        user: currentUserId,
        friend: targetUser._id,
        status: "pending",
        requestedBy: currentUserId,
      });

      await sendFriendRequestNotification(
        targetUser.email,
        currentUser.name,
        targetUser._id,
      );

      return res.status(201).json({ friendship, type: "request_sent" });
    } else {
      // ✅ CAS 2 : email non inscrit → invitation
      const existingInvitation = await Invitation.findOne({
        email,
        invitedBy: currentUserId,
        status: "pending",
      });

      if (existingInvitation) {
        // Si le compte invité a été supprimé entre temps, on recrée
        const invitedUserExists = await User.findOne({ email });
        if (!invitedUserExists) {
          await Invitation.deleteOne({ _id: existingInvitation._id });
        } else {
          return res
            .status(400)
            .json({ message: "Une invitation a déjà été envoyée à cet email" });
        }
      }

      const token = generateVerificationToken();

      await Invitation.create({
        email,
        invitedBy: currentUserId,
        token,
      });

      await sendInvitationEmail(email, currentUser.name, token);

      return res
        .status(201)
        .json({ type: "invitation_sent", message: "Invitation envoyée !" });
    }
  } catch (error) {
    next(error);
  }
});

// ========================================
// PATCH - Accepter une demande d'amitié
// ========================================
router.patch("/:friendshipId/accept", isAuthenticated, async (req, res) => {
  try {
    const { friendshipId } = req.params;
    const userId = req.payload._id;

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

    // ✅ Utilisation de l'utilitaire partagé
    try {
      const user1 = await User.findById(friendship.user);
      const user2 = await User.findById(friendship.friend);
      if (user1 && user2) {
        await createFriendDates(user1, user2);
      }
    } catch (error) {
      console.error("Erreur création dates automatiques:", error);
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
router.patch("/:friendshipId/reject", isAuthenticated, async (req, res) => {
  try {
    const { friendshipId } = req.params;
    const userId = req.payload._id;

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

    res.status(200).json({ message: "Demande d'amitié refusée", friendship });
  } catch (error) {
    console.error("Erreur lors du refus:", error);
    res.status(500).json({ message: "Erreur serveur", error: error.message });
  }
});

// ========================================
// PATCH - Lier un ami à une date existante
// ========================================
router.patch("/:friendshipId/link-date", isAuthenticated, async (req, res) => {
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
      return res
        .status(400)
        .json({ message: "L'amitié doit être acceptée pour lier une date" });
    }

    friendship.linkedDate = dateId;
    await friendship.save();

    const populatedFriendship = await Friend.findById(friendship._id)
      .populate("user", "name email")
      .populate("friend", "name email")
      .populate("linkedDate");

    res
      .status(200)
      .json({ message: "Date liée à l'ami", friendship: populatedFriendship });
  } catch (error) {
    console.error("Erreur lors de la liaison:", error);
    res.status(500).json({ message: "Erreur serveur", error: error.message });
  }
});

// ========================================
// DELETE - Supprimer un ami
// ========================================
router.delete("/:friendshipId", isAuthenticated, async (req, res) => {
  try {
    const { friendshipId } = req.params;

    if (!mongoose.isValidObjectId(friendshipId)) {
      return res.status(400).json({ message: "Friendship ID invalide" });
    }

    const friendship = await Friend.findById(friendshipId);

    if (!friendship) {
      return res.status(404).json({ message: "Amitié non trouvée" });
    }

    try {
      const user1Id = friendship.user;
      const user2Id = friendship.friend;

      await DateModel.findOneAndDelete({ owner: user1Id, linkedUser: user2Id });
      await DateModel.findOneAndDelete({ owner: user2Id, linkedUser: user1Id });

      if (friendship.linkedDate) {
        await DateModel.findByIdAndDelete(friendship.linkedDate);
      }
    } catch (error) {
      console.error("❌ Erreur suppression dates liées:", error);
    }

    await Friend.findByIdAndDelete(friendshipId);

    res
      .status(200)
      .json({ message: "Ami et dates associées supprimés", friendship });
  } catch (error) {
    console.error("❌ Erreur lors de la suppression:", error);
    res.status(500).json({ message: "Erreur serveur", error: error.message });
  }
});

module.exports = router;
