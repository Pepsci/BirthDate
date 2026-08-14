const express = require("express");
const router = express.Router();
const Friend = require("../models/friend.model");
const User = require("../models/user.model");
const DateModel = require("../models/date.model");
const Invitation = require("../models/invitation.model");
const mongoose = require("mongoose");
const { isAuthenticated } = require("../middleware/jwt.middleware");
const { notify } = require("../utils/notify");
const {
  sendFriendRequestNotification,
} = require("../services/emailTemplates/friendRequestEmailService");
const {
  sendInvitationEmail,
} = require("../services/emailTemplates/invitationEmail");
const { generateVerificationToken } = require("../services/verififcation");
const { createFriendDates } = require("../utils/friendDates");
const { isBlockedBetween } = require("../utils/blocking");
const WishlistModel = require("../models/wishlist.model");
const SharedGiftList = require("../models/sharedGiftList.model");

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
    res.status(500).json({ message: "Erreur serveur" });
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
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// ========================================
// GET - Demandes d'amitié envoyées + invitations externes
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

    const sentInvitations = await Invitation.find({
      invitedBy: userId,
      status: "pending",
    }).select("email createdAt token");

    res.status(200).json({
      requests: sentRequests,
      invitations: sentInvitations,
    });
  } catch (error) {
    console.error("Erreur:", error);
    res.status(500).json({ message: "Erreur serveur" });
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
      if (targetUser._id.toString() === currentUserId) {
        return res
          .status(400)
          .json({ message: "Vous ne pouvez pas vous ajouter vous-même" });
      }

      // Blocage dans un sens ou dans l'autre : refus SILENCIEUX. On répond
      // comme si la demande était partie, mais rien n'est créé et aucune
      // notification n'est envoyée. Une erreur explicite serait pire : elle
      // apprendrait au demandeur qu'il a été bloqué, et l'inciterait à passer
      // par une autre porte. Voir utils/blocking.js.
      if (await isBlockedBetween(currentUserId, targetUser._id)) {
        return res.status(201).json({ type: "request_sent" });
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

      // ── Notif applicative → destinataire de la demande ──
      await notify(req.app, {
        userId: targetUser._id,
        type: "friend_request",
        data: {
          name: `${currentUser.name} ${currentUser.surname || ""}`.trim(),
          avatar: currentUser.avatar,
        },
        link: "/home?tab=friends",
      });

      return res.status(201).json({ friendship, type: "request_sent" });
    } else {
      const existingInvitation = await Invitation.findOne({
        email,
        invitedBy: currentUserId,
        status: "pending",
      });

      if (existingInvitation) {
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
// POST /request-by-id - Demande d'amitié à un utilisateur connu par son _id
//
// Utilisé par les cartes anniversaire partagées dans le chat (date_share) :
// le message ne transporte que l'ObjectId de la personne, jamais son email.
// Exposer l'email d'un tiers dans un message stocké en base serait une fuite ;
// un ObjectId est opaque et inexploitable hors de l'app.
//
// À l'acceptation, createFriendDates() crée les cartes liées des deux côtés —
// inutile donc de créer une carte manuelle en parallèle.
// ========================================
router.post("/request-by-id", isAuthenticated, async (req, res, next) => {
  try {
    const { userId } = req.body;
    const currentUserId = req.payload._id;

    if (!mongoose.isValidObjectId(userId)) {
      return res.status(400).json({ message: "Utilisateur invalide" });
    }
    if (userId === currentUserId) {
      return res
        .status(400)
        .json({ message: "Vous ne pouvez pas vous ajouter vous-même" });
    }

    const [currentUser, targetUser] = await Promise.all([
      User.findById(currentUserId).select("name surname avatar"),
      User.findById(userId).select("name email deletedAt"),
    ]);

    if (!targetUser || targetUser.deletedAt) {
      return res.status(404).json({ message: "Utilisateur introuvable" });
    }

    // Refus silencieux en cas de blocage — même logique que POST /.
    if (await isBlockedBetween(currentUserId, targetUser._id)) {
      return res.status(201).json({ type: "request_sent" });
    }

    const existing = await Friend.findOne({
      $or: [
        { user: currentUserId, friend: userId },
        { user: userId, friend: currentUserId },
      ],
    });
    if (existing) {
      return res.status(400).json({
        message:
          existing.status === "accepted"
            ? "Vous êtes déjà amis"
            : "Une demande est déjà en cours",
      });
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

    await notify(req.app, {
      userId: targetUser._id,
      type: "friend_request",
      data: {
        name: `${currentUser.name} ${currentUser.surname || ""}`.trim(),
        avatar: currentUser.avatar,
      },
      link: "/home?tab=friends",
    });

    return res.status(201).json({ friendship, type: "request_sent" });
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

    try {
      const user1 = await User.findById(friendship.user);
      const user2 = await User.findById(friendship.friend);
      if (user1 && user2) {
        await createFriendDates(user1, user2);
      }

      // ── Notif applicative → celui qui avait envoyé la demande ──
      await notify(req.app, {
        userId: friendship.user,
        type: "friend_accepted",
        data: {
          name: `${user2.name} ${user2.surname || ""}`.trim(),
          avatar: user2.avatar,
        },
        link: "/home?tab=friends",
      });
    } catch (error) {
      console.error("Erreur création dates / notif:", error);
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
    res.status(500).json({ message: "Erreur serveur" });
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
    res.status(500).json({ message: "Erreur serveur" });
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
    res.status(500).json({ message: "Erreur serveur" });
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

    const userId = req.payload._id;
    const isParticipant =
      friendship.user.toString() === userId ||
      friendship.friend.toString() === userId;

    if (!isParticipant) {
      return res.status(403).json({ message: "Non autorisé" });
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
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// ========================================
// GET /:friendId/card-summary - Résumé pour la carte glissante (chat)
// 🔒 SÉCURISÉ : nécessite d'être ami
// Renvoie : identité + âge + prochain anniversaire + nombre d'idées dans sa
// wishlist partagée + liste de cadeaux commune si elle existe (sinon rien).
// ========================================
router.get("/:friendId/card-summary", isAuthenticated, async (req, res) => {
  try {
    const { friendId } = req.params;
    const userId = req.payload._id;

    if (!mongoose.isValidObjectId(friendId)) {
      return res.status(400).json({ message: "Invalid friend ID" });
    }
    if (friendId === userId.toString()) {
      return res.status(400).json({ message: "Invalid friend ID" });
    }
    if (!(await Friend.areFriends(userId, friendId))) {
      return res.status(403).json({ message: "Accès non autorisé" });
    }

    const friend = await User.findById(friendId).select(
      "name surname avatar birthDate nameday",
    );
    if (!friend) {
      return res.status(404).json({ message: "Utilisateur introuvable" });
    }

    const [wishlistCount, myLinkedDate] = await Promise.all([
      WishlistModel.countDocuments({ userId: friendId, isShared: true }),
      DateModel.findOne({ owner: userId, linkedUser: friendId }).select(
        "sharedGiftList",
      ),
    ]);
    // dateId : la carte anniversaire (Date) que JE possède pour cet ami —
    // c'est ce que le front utilise pour naviguer vers son profil
    // (/home?tab=date&dateId=... côté web, /date/:id côté mobile).
    const dateId = myLinkedDate?._id ?? null;

    let sharedGiftList = null;
    if (myLinkedDate?.sharedGiftList) {
      const list = await SharedGiftList.findById(
        myLinkedDate.sharedGiftList,
      ).select("gifts label");
      if (list) {
        sharedGiftList = {
          _id: list._id,
          label: list.label,
          giftCount: list.gifts?.length || 0,
        };
      }
    }

    res.status(200).json({
      _id: friend._id,
      dateId,
      name: friend.name,
      surname: friend.surname,
      avatar: friend.avatar,
      birthDate: friend.birthDate,
      nameday: friend.nameday,
      wishlistCount,
      sharedGiftList,
    });
  } catch (error) {
    console.error("❌ Erreur card-summary:", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

module.exports = router;
