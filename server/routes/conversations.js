// backend/routes/conversations.js
const express = require("express");
const router = express.Router();
const { isAuthenticated } = require("../middleware/jwt.middleware");
const Conversation = require("../models/conversation.model");
const Message = require("../models/message.model");
const User = require("../models/user.model");
const Friend = require("../models/friend.model");

// Récupérer toutes les conversations de l'utilisateur
router.get("/", isAuthenticated, async (req, res) => {
  try {
    const userId = req.payload._id;

    const conversations = await Conversation.find({
      participants: userId,
    })
      .populate("participants", "name surname email")
      .populate({
        path: "lastMessage",
        populate: {
          path: "sender",
          select: "name surname email",
        },
      })
      .sort({ lastMessageAt: -1 });

    // Pour chaque conversation, compter les messages non lus
    const conversationsWithUnread = await Promise.all(
      conversations.map(async (conv) => {
        const unreadCount = await Message.countDocuments({
          conversation: conv._id,
          sender: { $ne: userId },
          "readBy.user": { $ne: userId },
        });

        return {
          ...conv.toObject(),
          unreadCount,
        };
      }),
    );

    res.json(conversationsWithUnread);
  } catch (error) {
    console.error("Error fetching conversations:", error);
    res.status(500).json({ message: "Error fetching conversations" });
  }
});

// Créer ou récupérer une conversation avec un ami
router.post("/start", isAuthenticated, async (req, res) => {
  try {
    const userId = req.payload._id;
    const { friendId } = req.body;

    if (!friendId) {
      return res.status(400).json({ message: "friendId is required" });
    }

    // Vérifier que les deux utilisateurs sont amis
    const friendship = await Friend.findOne({
      $or: [
        { user: userId, friend: friendId, status: "accepted" },
        { user: friendId, friend: userId, status: "accepted" },
      ],
    });

    if (!friendship) {
      return res
        .status(403)
        .json({ message: "You are not friends with this user" });
    }

    // Trouver ou créer la conversation
    let conversation = await Conversation.findOne({
      participants: { $all: [userId, friendId], $size: 2 },
    })
      .populate("participants", "name surname email")
      .populate({
        path: "lastMessage",
        populate: {
          path: "sender",
          select: "name surname email",
        },
      });

    if (!conversation) {
      conversation = await Conversation.create({
        participants: [userId, friendId],
      });

      // Repopuler après création
      conversation = await Conversation.findById(conversation._id).populate(
        "participants",
        "name surname email",
      );
    }

    res.json(conversation);
  } catch (error) {
    console.error("Error starting conversation:", error);
    res.status(500).json({ message: "Error starting conversation" });
  }
});

// Récupérer les messages d'une conversation
router.get("/:conversationId/messages", isAuthenticated, async (req, res) => {
  try {
    const userId = req.payload._id;
    const { conversationId } = req.params;
    const { limit = 50, before } = req.query; // Pagination

    // Vérifier que l'utilisateur fait partie de la conversation
    const conversation = await Conversation.findOne({
      _id: conversationId,
      participants: userId,
    });

    if (!conversation) {
      return res.status(404).json({ message: "Conversation not found" });
    }

    // Construction de la requête
    const query = { conversation: conversationId };
    if (before) {
      query.createdAt = { $lt: new Date(before) };
    }

    const messages = await Message.find(query)
      .populate("sender", "name surname email")
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));

    // Inverser l'ordre pour avoir les plus anciens en premier
    messages.reverse();

    res.json(messages);
  } catch (error) {
    console.error("Error fetching messages:", error);
    res.status(500).json({ message: "Error fetching messages" });
  }
});

// Récupérer une conversation spécifique
router.get("/:conversationId", isAuthenticated, async (req, res) => {
  try {
    const userId = req.payload._id;
    const { conversationId } = req.params;

    const conversation = await Conversation.findOne({
      _id: conversationId,
      participants: userId,
    })
      .populate("participants", "name surname email")
      .populate({
        path: "lastMessage",
        populate: {
          path: "sender",
          select: "name surname email",
        },
      });

    if (!conversation) {
      return res.status(404).json({ message: "Conversation not found" });
    }

    // Compter les messages non lus
    const unreadCount = await Message.countDocuments({
      conversation: conversationId,
      sender: { $ne: userId },
      "readBy.user": { $ne: userId },
    });

    res.json({
      ...conversation.toObject(),
      unreadCount,
    });
  } catch (error) {
    console.error("Error fetching conversation:", error);
    res.status(500).json({ message: "Error fetching conversation" });
  }
});

// ⭐ NOUVELLE ROUTE - Marquer les messages comme lus
router.put("/:conversationId/read", isAuthenticated, async (req, res) => {
  try {
    const userId = req.payload._id;
    const { conversationId } = req.params;

    // Vérifier que l'utilisateur fait partie de la conversation
    const conversation = await Conversation.findOne({
      _id: conversationId,
      participants: userId,
    });

    if (!conversation) {
      return res.status(404).json({ message: "Conversation not found" });
    }

    // Trouver tous les messages non lus de cette conversation
    const unreadMessages = await Message.find({
      conversation: conversationId,
      sender: { $ne: userId },
      "readBy.user": { $ne: userId },
    });

    // Marquer chaque message comme lu
    const updatePromises = unreadMessages.map((message) => {
      message.readBy.push({
        user: userId,
        readAt: new Date(),
      });
      return message.save();
    });

    await Promise.all(updatePromises);

    res.json({
      success: true,
      message: "Messages marked as read",
      count: unreadMessages.length,
    });
  } catch (error) {
    console.error("Error marking messages as read:", error);
    res.status(500).json({ message: "Error marking messages as read" });
  }
});

// Supprimer un message
router.delete("/messages/:messageId", isAuthenticated, async (req, res) => {
  try {
    const userId = req.payload._id;
    const { messageId } = req.params;

    // Trouver le message
    const message = await Message.findById(messageId);

    if (!message) {
      return res.status(404).json({ message: "Message not found" });
    }

    // Vérifier que l'utilisateur est bien l'auteur du message
    if (message.sender.toString() !== userId) {
      return res
        .status(403)
        .json({ message: "You can only delete your own messages" });
    }

    // Vérifier que l'utilisateur fait partie de la conversation
    const conversation = await Conversation.findOne({
      _id: message.conversation,
      participants: userId,
    });

    if (!conversation) {
      return res.status(404).json({ message: "Conversation not found" });
    }

    const conversationId = message.conversation;

    // Modifier un message
    router.put("/messages/:messageId", isAuthenticated, async (req, res) => {
      try {
        const userId = req.payload._id;
        const { messageId } = req.params;
        const { content } = req.body;

        if (!content || content.trim().length === 0) {
          return res.status(400).json({ message: "Content cannot be empty" });
        }

        if (content.trim().length > 2000) {
          return res
            .status(400)
            .json({ message: "Content too long (max 2000 characters)" });
        }

        // Trouver le message
        const message = await Message.findById(messageId);

        if (!message) {
          return res.status(404).json({ message: "Message not found" });
        }

        // Vérifier que l'utilisateur est bien l'auteur
        if (message.sender.toString() !== userId) {
          return res
            .status(403)
            .json({ message: "You can only edit your own messages" });
        }

        // Vérifier le délai (5 minutes = 300000ms)
        const EDIT_TIME_LIMIT = 5 * 60 * 1000; // 5 minutes
        const messageAge = Date.now() - new Date(message.createdAt).getTime();

        if (messageAge > EDIT_TIME_LIMIT) {
          return res.status(403).json({
            message: "Cannot edit messages older than 5 minutes",
          });
        }

        // Vérifier que l'utilisateur fait partie de la conversation
        const conversation = await Conversation.findOne({
          _id: message.conversation,
          participants: userId,
        });

        if (!conversation) {
          return res.status(404).json({ message: "Conversation not found" });
        }

        // Mettre à jour le message
        message.content = content.trim();
        message.edited = true;
        message.editedAt = new Date();
        await message.save();

        // Populer les infos du sender
        await message.populate("sender", "name surname email");

        res.json({
          success: true,
          message: "Message updated",
          updatedMessage: message,
        });
      } catch (error) {
        console.error("Error updating message:", error);
        res.status(500).json({ message: "Error updating message" });
      }
    });

    // Supprimer une conversation
    router.delete("/:conversationId", isAuthenticated, async (req, res) => {
      try {
        const userId = req.payload._id;
        const { conversationId } = req.params;

        // Vérifier que l'utilisateur fait partie de la conversation
        const conversation = await Conversation.findOne({
          _id: conversationId,
          participants: userId,
        });

        if (!conversation) {
          return res.status(404).json({ message: "Conversation not found" });
        }

        // Supprimer tous les messages de la conversation
        await Message.deleteMany({ conversation: conversationId });

        // Supprimer la conversation
        await Conversation.findByIdAndDelete(conversationId);

        res.json({
          success: true,
          message: "Conversation deleted",
          conversationId,
        });
      } catch (error) {
        console.error("Error deleting conversation:", error);
        res.status(500).json({ message: "Error deleting conversation" });
      }
    });

    // Supprimer le message
    await Message.findByIdAndDelete(messageId);

    // Si c'était le dernier message, mettre à jour la conversation
    if (conversation.lastMessage?.toString() === messageId) {
      const previousMessage = await Message.findOne({
        conversation: conversationId,
      })
        .sort({ createdAt: -1 })
        .limit(1);

      if (previousMessage) {
        conversation.lastMessage = previousMessage._id;
        conversation.lastMessageAt = previousMessage.createdAt;
      } else {
        conversation.lastMessage = null;
        conversation.lastMessageAt = new Date();
      }
      await conversation.save();
    }

    res.json({
      success: true,
      message: "Message deleted",
      messageId,
      conversationId,
    });
  } catch (error) {
    console.error("Error deleting message:", error);
    res.status(500).json({ message: "Error deleting message" });
  }
});

module.exports = router;
