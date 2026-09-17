const Conversation = require("../models/conversation.model");
const Message = require("../models/message.model");
const User = require("../models/user.model");
const { sendPushToUser } = require("../services/pushService");
const { notify } = require("../utils/notify");
const { isBlockedBetween } = require("../utils/blocking");
const { REACTIONS } = require("../constants/reactions");
const {
  sendDirectMessage,
  SendMessageError,
} = require("../services/sendDirectMessage");
const {
  markDeliveredForUser,
  deliveryReceiptFields,
  emitRead,
} = require("../utils/messageReceipts");
const {
  addSocket,
  setSocketPushToken,
  removeSocket,
} = require("../utils/presence");

module.exports = (io, socket, connectedUsers, app) => {
  console.log(`📱 User connected: ${socket.userId}`);

  // Plusieurs sockets par compte (web + iPhone + Android) : on ne signale
  // « en ligne » qu'au premier, « hors ligne » qu'au dernier.
  if (addSocket(connectedUsers, socket)) {
    socket.broadcast.emit("user:online", { userId: socket.userId });
  }

  // Connexion = l'appareil est joignable : tout ce qui attendait est distribué.
  markDeliveredForUser(io, socket.userId).catch((err) =>
    console.error("❌ Error marking messages delivered:", err),
  );

  socket.on("users:getOnline", () => {
    const onlineUserIds = Array.from(connectedUsers.keys());
    socket.emit("users:online", { userIds: onlineUserIds });
    console.log(
      `📋 Sent online users list to ${socket.userId}:`,
      onlineUserIds,
    );
  });

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

  socket.on("conversation:join", async ({ conversationId }) => {
    try {
      const conversation = await Conversation.findOne({
        _id: conversationId,
        participants: socket.userId,
      });
      if (conversation) {
        socket.join(`conversation:${conversationId}`);
        console.log(
          `✅ User ${socket.userId} joined conversation ${conversationId}`,
        );
        await Message.updateMany(
          {
            conversation: conversationId,
            sender: { $ne: socket.userId },
            "readBy.user": { $ne: socket.userId },
          },
          { $push: { readBy: { user: socket.userId, readAt: new Date() } } },
        );
        emitRead(io, conversation, socket.userId);
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
    const { conversationId, tempId } = data || {};
    try {
      const { message } = await sendDirectMessage({
        io,
        app,
        connectedUsers,
        senderId: socket.userId,
        data,
      });

      socket.emit("message:new", {
        conversationId,
        message: { ...message, tempId },
      });
      socket.to(`conversation:${conversationId}`).emit("message:new", {
        conversationId,
        message,
      });
    } catch (error) {
      if (!(error instanceof SendMessageError)) {
        console.error("❌ Error sending message:", error);
      }
      socket.emit("message:error", {
        tempId,
        error:
          error instanceof SendMessageError
            ? error.message
            : "Impossible d'envoyer le message",
      });
    }
  });

  socket.on("typing:start", async ({ conversationId }) => {
    const conv = await Conversation.findOne({
      _id: conversationId,
      participants: socket.userId,
    });
    if (!conv) return;
    socket
      .to(`conversation:${conversationId}`)
      .emit("typing:start", { conversationId, userId: socket.userId });
  });

  socket.on("typing:stop", async ({ conversationId }) => {
    const conv = await Conversation.findOne({
      _id: conversationId,
      participants: socket.userId,
    });
    if (!conv) return;
    socket
      .to(`conversation:${conversationId}`)
      .emit("typing:stop", { conversationId, userId: socket.userId });
  });

  socket.on("messages:read", async ({ conversationId }) => {
    try {
      const conv = await Conversation.findOne({
        _id: conversationId,
        participants: socket.userId,
      });
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
        emitRead(io, conv, socket.userId);
        console.log(
          `✅ ${result.modifiedCount} messages marked as read in conversation ${conversationId}`,
        );
      }
    } catch (error) {
      console.error("❌ Error marking messages as read:", error);
    }
  });

  /*
   * Poser ou retirer une réaction sur un message.
   *
   * ⚠️ Une seule réaction par personne et par message : envoyer la même
   * remplace un retrait (bascule), envoyer une autre remplace la précédente.
   * C'est le comportement de WhatsApp, et c'est ce qui évite qu'un message se
   * retrouve avec quatre réactions du même utilisateur.
   *
   * ⚠️ On n'exige PAS d'être l'auteur : réagir au message d'autrui est tout
   * l'intérêt. En revanche il faut appartenir à la conversation — sans ce
   * contrôle, n'importe qui connaissant un identifiant de message pourrait
   * réagir dessus.
   */
  socket.on("message:react", async ({ messageId, conversationId, reaction }) => {
    try {
      if (reaction !== null && !REACTIONS.includes(reaction)) {
        return socket.emit("error", { message: "Réaction inconnue" });
      }

      const message = await Message.findById(messageId).select(
        "conversation reactions sender",
      );
      if (!message) {
        return socket.emit("error", { message: "Message introuvable" });
      }

      const conversation = await Conversation.findById(message.conversation)
        .select("participants")
        .lean();
      const isParticipant = conversation?.participants?.some(
        (p) => String(p) === socket.userId,
      );
      if (!isParticipant) {
        return socket.emit("error", { message: "Non autorisé" });
      }

      const existing = message.reactions.find(
        (r) => String(r.user) === socket.userId,
      );

      // Même réaction que celle déjà posée, ou `null` explicite → on retire.
      const removing = reaction === null || existing?.reaction === reaction;

      message.reactions = message.reactions.filter(
        (r) => String(r.user) !== socket.userId,
      );
      if (!removing) {
        message.reactions.push({
          user: socket.userId,
          reaction,
          createdAt: new Date(),
        });
      }
      await message.save();

      /*
       * Notifier l'auteur du message.
       *
       * ⚠️ Seulement à la POSE, jamais au retrait : être prévenu qu'on vous
       * a retiré un cœur est une information dont personne n'a besoin, et qui
       * doublerait le volume.
       *
       * ⚠️ Jamais à soi-même : réagir à son propre message ne doit rien
       * déclencher.
       *
       * Aucun extrait du message dans la notification : il est chiffré de bout
       * en bout, le serveur ne peut pas le lire.
       */
      const authorId = String(message.sender);
      if (!removing && authorId !== socket.userId) {
        const reactor = await User.findById(socket.userId, "name surname");
        const reactorName = reactor
          ? `${reactor.name} ${reactor.surname || ""}`.trim()
          : "Quelqu'un";
        const convId = conversationId || String(message.conversation);

        notify(app, {
          userId: authorId,
          type: "message_reaction",
          data: {
            reactorName,
            reaction,
            messageId: String(messageId),
            conversationId: convId,
          },
          link: `/home?tab=chat&conversationId=${convId}`,
        }).catch((err) => console.error("❌ Notify reaction error:", err));
      }

      // Diffusion à toute la conversation, y compris à l'auteur de la
      // réaction : c'est ce qui garantit que tous les appareils d'une même
      // personne restent d'accord entre eux.
      io.to(`conversation:${String(message.conversation)}`).emit(
        "message:reacted",
        {
          messageId,
          conversationId: conversationId || String(message.conversation),
          reactions: message.reactions.map((r) => ({
            user: String(r.user),
            reaction: r.reaction,
          })),
        },
      );
    } catch (error) {
      console.error("❌ Error reacting to message:", error);
      socket.emit("error", { message: "Réaction impossible" });
    }
  });

  socket.on("message:delete", async ({ messageId, conversationId }) => {
    try {
      const message = await Message.findById(messageId);
      if (!message)
        return socket.emit("error", { message: "Message not found" });
      if (message.sender.toString() !== socket.userId) {
        return socket.emit("error", {
          message: "You can only delete your own messages",
        });
      }
      await Message.findByIdAndDelete(messageId);
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

  socket.on(
    "message:edit",
    async ({
      messageId,
      content,
      conversationId,
      encryptedForRecipient,
      encryptedForSender,
    }) => {
    try {
      const message = await Message.findById(messageId);
      if (!message)
        return socket.emit("error", { message: "Message not found" });
      if (message.sender.toString() !== socket.userId) {
        return socket.emit("error", {
          message: "You can only edit your own messages",
        });
      }
      // Messages chiffrés : modifiables uniquement si le client fournit les
      // deux copies re-chiffrées (mobile E2E) — sinon comportement historique.
      const isEncryptedEdit =
        message.isEncrypted && encryptedForRecipient && encryptedForSender;
      if (message.isEncrypted && !isEncryptedEdit) {
        return socket.emit("error", {
          message: "Les messages chiffrés ne peuvent pas être modifiés",
        });
      }
      if (message.type === "gift_share" || message.type === "date_share") {
        return socket.emit("error", {
          message: "Les cartes partagées ne peuvent pas être modifiées",
        });
      }
      const EDIT_TIME_LIMIT = 5 * 60 * 1000;
      if (
        Date.now() - new Date(message.createdAt).getTime() >
        EDIT_TIME_LIMIT
      ) {
        return socket.emit("error", {
          message: "Cannot edit messages older than 5 minutes",
        });
      }
      if (!content || content.trim().length === 0) {
        return socket.emit("error", { message: "Content cannot be empty" });
      }

      if (isEncryptedEdit) {
        // Re-chiffrement complet : content = copie expéditeur (même règle que send)
        const conversation = await Conversation.findById(
          message.conversation,
        ).select("participants");
        const recipientId = conversation?.participants.find(
          (p) => p.toString() !== socket.userId,
        );
        const encFor = {};
        if (recipientId)
          encFor[recipientId.toString()] = encryptedForRecipient;
        encFor[socket.userId] = encryptedForSender;
        message.encryptedFor = encFor;
        message.content = encryptedForSender;
      } else {
        message.content = content.trim();
      }
      message.edited = true;
      message.editedAt = new Date();
      await message.save();
      await message.populate("sender", "name surname email publicKey");

      const encryptedForObj =
        message.encryptedFor instanceof Map
          ? Object.fromEntries(message.encryptedFor)
          : message.encryptedFor;

      io.to(`conversation:${conversationId}`).emit("message:edited", {
        messageId,
        conversationId,
        content: message.content,
        isEncrypted: message.isEncrypted,
        encryptedFor: encryptedForObj,
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
      const conversation = await Conversation.findOne({
        _id: conversationId,
        participants: socket.userId,
      });
      if (!conversation)
        return socket.emit("error", { message: "Conversation not found" });
      await Message.deleteMany({ conversation: conversationId });
      await Conversation.findByIdAndDelete(conversationId);
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

  // L'app mobile obtient parfois son jeton push APRÈS l'ouverture du socket
  // (premier lancement, permission en attente) : elle l'annonce ici.
  socket.on("presence:pushToken", ({ pushToken } = {}) => {
    setSocketPushToken(connectedUsers, socket, pushToken);
  });

  socket.on("disconnect", () => {
    console.log(`👋 User disconnected: ${socket.userId}`);
    if (removeSocket(connectedUsers, socket)) {
      socket.broadcast.emit("user:offline", { userId: socket.userId });
    }
  });
};
