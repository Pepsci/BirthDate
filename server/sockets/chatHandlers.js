const Conversation = require("../models/conversation.model");
const Message = require("../models/message.model");
const User = require("../models/user.model");

// Map pour suivre les utilisateurs connectés
const connectedUsers = new Map();

module.exports = (io) => {
  io.on("connection", (socket) => {
    console.log(`📱 User connected: ${socket.userId}`);

    // Ajouter l'utilisateur à la map des connectés
    connectedUsers.set(socket.userId, socket.id);

    // Notifier les amis que l'utilisateur est en ligne
    socket.broadcast.emit("user:online", { userId: socket.userId });

    socket.on("users:getOnline", () => {
      const onlineUserIds = Array.from(connectedUsers.keys());
      socket.emit("users:online", { userIds: onlineUserIds });
      console.log(
        `📋 Sent online users list to ${socket.userId}:`,
        onlineUserIds,
      );
    });

    // Rejoindre les rooms des conversations de l'utilisateur
    socket.on("conversations:join", async () => {
      try {
        const conversations = await Conversation.find({
          participants: socket.userId,
        });

        conversations.forEach((conv) => {
          socket.join(`conversation:${conv._id}`);
        });

        console.log(
          `✅ User ${socket.userId} joined ${conversations.length} conversations`,
        );
      } catch (error) {
        console.error("❌ Error joining conversations:", error);
      }
    });

    // Rejoindre une conversation spécifique
    socket.on("conversation:join", async ({ conversationId }) => {
      try {
        // Vérifier que l'utilisateur fait partie de la conversation
        const conversation = await Conversation.findOne({
          _id: conversationId,
          participants: socket.userId,
        });

        if (conversation) {
          socket.join(`conversation:${conversationId}`);
          console.log(
            `✅ User ${socket.userId} joined conversation ${conversationId}`,
          );

          // Marquer automatiquement les messages comme lus quand on rejoint
          await Message.updateMany(
            {
              conversation: conversationId,
              sender: { $ne: socket.userId },
              "readBy.user": { $ne: socket.userId },
            },
            {
              $push: {
                readBy: {
                  user: socket.userId,
                  readAt: new Date(),
                },
              },
            },
          );

          // Notifier les autres participants
          socket.to(`conversation:${conversationId}`).emit("messages:read", {
            conversationId,
            userId: socket.userId,
          });
        }
      } catch (error) {
        console.error("❌ Error joining conversation:", error);
      }
    });

    // Quitter une conversation spécifique
    socket.on("conversation:leave", ({ conversationId }) => {
      socket.leave(`conversation:${conversationId}`);
      console.log(
        `👋 User ${socket.userId} left conversation ${conversationId}`,
      );
    });

    // Envoyer un message
    socket.on("message:send", async (data) => {
      try {
        const { conversationId, content } = data;

        if (!content || content.trim().length === 0) {
          return socket.emit("error", { message: "Message cannot be empty" });
        }

        // Vérifier que l'utilisateur fait partie de la conversation
        const conversation = await Conversation.findOne({
          _id: conversationId,
          participants: socket.userId,
        });

        if (!conversation) {
          return socket.emit("error", { message: "Conversation not found" });
        }

        // Créer le message
        const message = new Message({
          conversation: conversationId,
          sender: socket.userId,
          content: content.trim(),
          readBy: [{ user: socket.userId }],
        });

        await message.save();

        // Mettre à jour la conversation
        conversation.lastMessage = message._id;
        conversation.lastMessageAt = message.createdAt;
        await conversation.save();

        // Populer les infos du sender
        await message.populate("sender", "name surname email");

        // Envoyer le message à tous les participants de la conversation
        io.to(`conversation:${conversationId}`).emit("message:new", {
          conversationId,
          message,
        });

        // Mettre à jour le badge de conversation pour les autres participants
        const otherParticipant = conversation.participants.find(
          (p) => p.toString() !== socket.userId,
        );

        if (otherParticipant) {
          io.to(`conversation:${conversationId}`).emit("conversation:updated", {
            conversationId,
            lastMessage: message,
            lastMessageAt: message.createdAt,
          });
        }

        console.log(`💬 Message sent in conversation ${conversationId}`);
      } catch (error) {
        console.error("❌ Error sending message:", error);
        socket.emit("error", { message: "Failed to send message" });
      }
    });

    // L'utilisateur est en train d'écrire
    socket.on("typing:start", ({ conversationId }) => {
      socket.to(`conversation:${conversationId}`).emit("typing:start", {
        conversationId,
        userId: socket.userId,
      });
    });

    // L'utilisateur a arrêté d'écrire
    socket.on("typing:stop", ({ conversationId }) => {
      socket.to(`conversation:${conversationId}`).emit("typing:stop", {
        conversationId,
        userId: socket.userId,
      });
    });

    // Marquer les messages comme lus (quand l'utilisateur scroll ou focus)
    socket.on("messages:read", async ({ conversationId }) => {
      try {
        const result = await Message.updateMany(
          {
            conversation: conversationId,
            sender: { $ne: socket.userId },
            "readBy.user": { $ne: socket.userId },
          },
          {
            $push: {
              readBy: {
                user: socket.userId,
                readAt: new Date(),
              },
            },
          },
        );

        // Notifier les autres participants seulement si des messages ont été marqués
        if (result.modifiedCount > 0) {
          socket.to(`conversation:${conversationId}`).emit("messages:read", {
            conversationId,
            userId: socket.userId,
            count: result.modifiedCount,
          });

          console.log(
            `✅ ${result.modifiedCount} messages marked as read in conversation ${conversationId}`,
          );
        }
      } catch (error) {
        console.error("❌ Error marking messages as read:", error);
      }
    });

    // Supprimer un message
    socket.on("message:delete", async ({ messageId, conversationId }) => {
      try {
        const message = await Message.findById(messageId);

        if (!message) {
          return socket.emit("error", { message: "Message not found" });
        }

        // Vérifier que l'utilisateur est bien l'auteur
        if (message.sender.toString() !== socket.userId) {
          return socket.emit("error", {
            message: "You can only delete your own messages",
          });
        }

        // Supprimer le message
        await Message.findByIdAndDelete(messageId);

        // Notifier tous les participants de la suppression
        io.to(`conversation:${conversationId}`).emit("message:deleted", {
          messageId,
          conversationId,
        });

        console.log(`🗑️ Message ${messageId} deleted by ${socket.userId}`);
      } catch (error) {
        console.error("❌ Error deleting message:", error);
        socket.emit("error", { message: "Failed to delete message" });
      }
    });

    // Modifier un message
    socket.on(
      "message:edit",
      async ({ messageId, content, conversationId }) => {
        try {
          const message = await Message.findById(messageId);

          if (!message) {
            return socket.emit("error", { message: "Message not found" });
          }

          // Vérifier que l'utilisateur est bien l'auteur
          if (message.sender.toString() !== socket.userId) {
            return socket.emit("error", {
              message: "You can only edit your own messages",
            });
          }

          // Vérifier le délai (5 minutes)
          const EDIT_TIME_LIMIT = 5 * 60 * 1000;
          const messageAge = Date.now() - new Date(message.createdAt).getTime();

          if (messageAge > EDIT_TIME_LIMIT) {
            return socket.emit("error", {
              message: "Cannot edit messages older than 5 minutes",
            });
          }

          if (!content || content.trim().length === 0) {
            return socket.emit("error", { message: "Content cannot be empty" });
          }

          // Mettre à jour le message
          message.content = content.trim();
          message.edited = true;
          message.editedAt = new Date();
          await message.save();

          // Populer les infos du sender
          await message.populate("sender", "name surname email");

          // Notifier tous les participants
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
      },
    );

    // Supprimer une conversation
    socket.on("conversation:delete", async ({ conversationId }) => {
      try {
        const conversation = await Conversation.findOne({
          _id: conversationId,
          participants: socket.userId,
        });

        if (!conversation) {
          return socket.emit("error", { message: "Conversation not found" });
        }

        // Supprimer tous les messages
        await Message.deleteMany({ conversation: conversationId });

        // Supprimer la conversation
        await Conversation.findByIdAndDelete(conversationId);

        // Notifier tous les participants
        io.to(`conversation:${conversationId}`).emit("conversation:deleted", {
          conversationId,
        });

        console.log(
          `🗑️ Conversation ${conversationId} deleted by ${socket.userId}`,
        );
      } catch (error) {
        console.error("❌ Error deleting conversation:", error);
        socket.emit("error", { message: "Failed to delete conversation" });
      }
    });

    // Déconnexion
    socket.on("disconnect", () => {
      console.log(`👋 User disconnected: ${socket.userId}`);
      connectedUsers.delete(socket.userId);

      // Notifier les amis que l'utilisateur est hors ligne
      socket.broadcast.emit("user:offline", { userId: socket.userId });
    });
  });
};
