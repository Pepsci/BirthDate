const Conversation = require("../models/conversation.model");
const Message = require("../models/message.model");
const User = require("../models/user.model");
const { sendPushToUser } = require("../services/pushService");

module.exports = (io, socket, connectedUsers) => {
  console.log(`📱 User connected: ${socket.userId}`);

  connectedUsers.set(socket.userId, socket.id);
  socket.broadcast.emit("user:online", { userId: socket.userId });

  socket.on("users:getOnline", () => {
    const onlineUserIds = Array.from(connectedUsers.keys());
    socket.emit("users:online", { userIds: onlineUserIds });
    console.log(`📋 Sent online users list to ${socket.userId}:`, onlineUserIds);
  });

  socket.on("conversations:join", async () => {
    try {
      const conversations = await Conversation.find({ participants: socket.userId });
      conversations.forEach((conv) => {
        socket.join(`conversation:${conv._id}`);
      });
      console.log(`✅ User ${socket.userId} joined ${conversations.length} conversations`);
    } catch (error) {
      console.error("❌ Error joining conversations:", error);
    }
  });

  socket.on("conversation:join", async ({ conversationId }) => {
    try {
      const conversation = await Conversation.findOne({
        _id: conversationId,
        participants: socket.userId,
      });
      if (conversation) {
        socket.join(`conversation:${conversationId}`);
        console.log(`✅ User ${socket.userId} joined conversation ${conversationId}`);
        await Message.updateMany(
          {
            conversation: conversationId,
            sender: { $ne: socket.userId },
            "readBy.user": { $ne: socket.userId },
          },
          { $push: { readBy: { user: socket.userId, readAt: new Date() } } },
        );
        socket.to(`conversation:${conversationId}`).emit("messages:read", {
          conversationId,
          userId: socket.userId,
        });
      }
    } catch (error) {
      console.error("❌ Error joining conversation:", error);
    }
  });

  socket.on("conversation:leave", ({ conversationId }) => {
    socket.leave(`conversation:${conversationId}`);
    console.log(`👋 User ${socket.userId} left conversation ${conversationId}`);
  });

  socket.on("message:send", async (data) => {
    const {
      conversationId,
      content,
      type,
      metadata,
      isEncrypted,
      encryptedForRecipient,
      encryptedForSender,
      tempId,
    } = data;

    try {
      if (!content || content.trim().length === 0) {
        return socket.emit("message:error", { tempId, error: "Le message ne peut pas être vide" });
      }

      // Les gift_share ont un contenu fallback court, les messages chiffrés peuvent être longs
      const maxLength = isEncrypted ? 50000 : 2000;
      if (content.trim().length > maxLength) {
        return socket.emit("message:error", { tempId, error: "Le message est trop long" });
      }

      const conversation = await Conversation.findOne({
        _id: conversationId,
        participants: socket.userId,
      });
      if (!conversation) {
        return socket.emit("message:error", { tempId, error: "Conversation introuvable" });
      }

      const recipientId = conversation.participants.find(
        (p) => p.toString() !== socket.userId,
      );

      const messageType = type === "gift_share" ? "gift_share" : "text";

      const messageData = {
        conversation: conversationId,
        sender: socket.userId,
        content: content.trim(),
        type: messageType,
        readBy: [{ user: socket.userId }],
        isEncrypted: messageType === "gift_share" ? false : !!isEncrypted,
      };

      // Métadonnées structurées pour les cartes cadeaux — jamais chiffrées
      if (messageType === "gift_share" && metadata) {
        messageData.metadata = metadata;
      }

      // Chiffrement E2E — uniquement pour les messages texte
      if (messageType === "text" && isEncrypted && encryptedForRecipient && encryptedForSender) {
        const encFor = {};
        if (recipientId) encFor[recipientId.toString()] = encryptedForRecipient;
        encFor[socket.userId] = encryptedForSender;
        if (Object.keys(encFor).length > 0) messageData.encryptedFor = encFor;
      }

      const message = new Message(messageData);
      await message.save();

      conversation.lastMessage = message._id;
      conversation.lastMessageAt = message.createdAt;
      await conversation.save();

      // ── Push notification pour le destinataire hors ligne ──────────────────
      if (recipientId && !connectedUsers.has(recipientId.toString())) {
        const sender = await User.findById(socket.userId, "name surname");
        const senderName = sender
          ? `${sender.name} ${sender.surname || ""}`.trim()
          : "Quelqu'un";

        let pushBody;
        if (messageType === "gift_share") {
          const personName = metadata?.personName || "quelqu'un";
          pushBody = `🎁 Idées cadeaux pour ${personName}`;
        } else if (isEncrypted) {
          pushBody = "🔒 Nouveau message chiffré";
        } else {
          pushBody = content.trim().slice(0, 100);
        }

        sendPushToUser(recipientId, {
          title: `💬 ${senderName}`,
          body: pushBody,
          url: "/home",
          tag: `chat-${conversationId}`,
          type: "chat",
          friendId: socket.userId,
        }).catch((err) => console.error("❌ Push chat error:", err));
      }

      await message.populate("sender", "name surname email publicKey");

      // Conversion Map → objet plain pour la sérialisation Socket.io
      const toSerializable = (msgObj) => {
        if (msgObj.encryptedFor instanceof Map) {
          msgObj.encryptedFor = Object.fromEntries(msgObj.encryptedFor);
        }
        return msgObj;
      };

      // L'expéditeur reçoit le message avec le tempId pour remplacer l'optimiste
      socket.emit("message:new", {
        conversationId,
        message: toSerializable({ ...message.toObject(), tempId }),
      });

      // Les autres participants reçoivent le message sans tempId
      socket.to(`conversation:${conversationId}`).emit("message:new", {
        conversationId,
        message: toSerializable(message.toObject()),
      });

      console.log(`💬 Message [${messageType}] sent in conversation ${conversationId}`);
    } catch (error) {
      console.error("❌ Error sending message:", error);
      socket.emit("message:error", { tempId, error: "Impossible d'envoyer le message" });
    }
  });

  socket.on("typing:start", async ({ conversationId }) => {
    const conv = await Conversation.findOne({ _id: conversationId, participants: socket.userId });
    if (!conv) return;
    socket.to(`conversation:${conversationId}`).emit("typing:start", { conversationId, userId: socket.userId });
  });

  socket.on("typing:stop", async ({ conversationId }) => {
    const conv = await Conversation.findOne({ _id: conversationId, participants: socket.userId });
    if (!conv) return;
    socket.to(`conversation:${conversationId}`).emit("typing:stop", { conversationId, userId: socket.userId });
  });

  socket.on("messages:read", async ({ conversationId }) => {
    try {
      const conv = await Conversation.findOne({ _id: conversationId, participants: socket.userId });
      if (!conv) return;
      const result = await Message.updateMany(
        {
          conversation: conversationId,
          sender: { $ne: socket.userId },
          "readBy.user": { $ne: socket.userId },
        },
        { $push: { readBy: { user: socket.userId, readAt: new Date() } } },
      );
      if (result.modifiedCount > 0) {
        socket.to(`conversation:${conversationId}`).emit("messages:read", {
          conversationId,
          userId: socket.userId,
          count: result.modifiedCount,
        });
        console.log(`✅ ${result.modifiedCount} messages marked as read in conversation ${conversationId}`);
      }
    } catch (error) {
      console.error("❌ Error marking messages as read:", error);
    }
  });

  socket.on("message:delete", async ({ messageId, conversationId }) => {
    try {
      const message = await Message.findById(messageId);
      if (!message) return socket.emit("error", { message: "Message not found" });
      if (message.sender.toString() !== socket.userId) {
        return socket.emit("error", { message: "You can only delete your own messages" });
      }
      await Message.findByIdAndDelete(messageId);
      io.to(`conversation:${conversationId}`).emit("message:deleted", { messageId, conversationId });
      console.log(`🗑️ Message ${messageId} deleted by ${socket.userId}`);
    } catch (error) {
      console.error("❌ Error deleting message:", error);
      socket.emit("error", { message: "Failed to delete message" });
    }
  });

  socket.on("message:edit", async ({ messageId, content, conversationId }) => {
    try {
      const message = await Message.findById(messageId);
      if (!message) return socket.emit("error", { message: "Message not found" });
      if (message.sender.toString() !== socket.userId) {
        return socket.emit("error", { message: "You can only edit your own messages" });
      }
      // Les messages chiffrés et les cartes cadeaux ne peuvent pas être modifiés
      if (message.isEncrypted) {
        return socket.emit("error", { message: "Les messages chiffrés ne peuvent pas être modifiés" });
      }
      if (message.type === "gift_share") {
        return socket.emit("error", { message: "Les cartes cadeaux ne peuvent pas être modifiées" });
      }
      const EDIT_TIME_LIMIT = 5 * 60 * 1000;
      if (Date.now() - new Date(message.createdAt).getTime() > EDIT_TIME_LIMIT) {
        return socket.emit("error", { message: "Cannot edit messages older than 5 minutes" });
      }
      if (!content || content.trim().length === 0) {
        return socket.emit("error", { message: "Content cannot be empty" });
      }
      message.content = content.trim();
      message.edited = true;
      message.editedAt = new Date();
      await message.save();
      await message.populate("sender", "name surname email publicKey");
      io.to(`conversation:${conversationId}`).emit("message:edited", {
        messageId,
        conversationId,
        content: message.content,
        edited: true,
        editedAt: message.editedAt,
      });
      console.log(`✏️ Message ${messageId} edited by ${socket.userId}`);
    } catch (error) {
      console.error("❌ Error editing message:", error);
      socket.emit("error", { message: "Failed to edit message" });
    }
  });

  socket.on("conversation:delete", async ({ conversationId }) => {
    try {
      const conversation = await Conversation.findOne({ _id: conversationId, participants: socket.userId });
      if (!conversation) return socket.emit("error", { message: "Conversation not found" });
      await Message.deleteMany({ conversation: conversationId });
      await Conversation.findByIdAndDelete(conversationId);
      io.to(`conversation:${conversationId}`).emit("conversation:deleted", { conversationId });
      console.log(`🗑️ Conversation ${conversationId} deleted by ${socket.userId}`);
    } catch (error) {
      console.error("❌ Error deleting conversation:", error);
      socket.emit("error", { message: "Failed to delete conversation" });
    }
  });

  socket.on("disconnect", () => {
    console.log(`👋 User disconnected: ${socket.userId}`);
    connectedUsers.delete(socket.userId);
    socket.broadcast.emit("user:offline", { userId: socket.userId });
  });
};