/**
 * Envoi d'un message privé — logique commune au socket (`message:send`) et à
 * la route REST `POST /api/conversations/:conversationId/messages`.
 *
 * ⚠️ La route REST existe pour la réponse depuis une notification push : app
 * fermée, il n'y a pas de socket. Toute règle d'envoi (blocage, longueur,
 * push, notification…) vit donc ICI et nulle part ailleurs, sinon les deux
 * chemins divergeraient.
 *
 * Idempotence : `clientId` (UUID généré par l'appareil) permet de rejouer un
 * envoi interrompu sans créer de doublon — une réponse depuis la notification
 * peut être coupée net par iOS et retentée au lancement suivant.
 */
const mongoose = require("mongoose");
const Conversation = require("../models/conversation.model");
const Message = require("../models/message.model");
const User = require("../models/user.model");
const { sendPushToUser } = require("./pushService");
const { notify } = require("../utils/notify");
const { isBlockedBetween } = require("../utils/blocking");
const { deliveryReceiptFields } = require("../utils/messageReceipts");
const { isOnline, hasClient, socketIdsOf } = require("../utils/presence");

/** Erreur « métier » : son message peut être montré tel quel à l'utilisateur. */
class SendMessageError extends Error {}

const toSerializable = (msgObj) => {
  if (msgObj.encryptedFor instanceof Map) {
    msgObj.encryptedFor = Object.fromEntries(msgObj.encryptedFor);
  }
  return msgObj;
};

/**
 * @returns {Promise<{ message: object, duplicate: boolean }>} message peuplé et sérialisable
 */
async function sendDirectMessage({ io, app, connectedUsers, senderId, data }) {
  senderId = String(senderId);
  const {
    conversationId,
    content,
    type,
    metadata,
    isEncrypted,
    encryptedForRecipient,
    encryptedForSender,
    replyTo,
    tempId,
    clientId,
  } = data || {};

  if (!mongoose.isValidObjectId(conversationId)) {
    throw new SendMessageError("Conversation introuvable");
  }
  if (typeof content !== "string") {
    throw new SendMessageError("Le message ne peut pas être vide");
  }

  // Rejeu d'un envoi déjà enregistré : on renvoie l'original, sans rien renotifier.
  if (clientId) {
    const existing = await Message.findOne({
      conversation: conversationId,
      sender: senderId,
      clientId: String(clientId).slice(0, 64),
    }).populate("sender", "name surname email publicKey");
    if (existing) {
      return { message: toSerializable(existing.toObject()), duplicate: true };
    }
  }

  if (!content || content.trim().length === 0) {
    throw new SendMessageError("Le message ne peut pas être vide");
  }

  const maxLength = isEncrypted ? 50000 : 2000;
  if (content.trim().length > maxLength) {
    throw new SendMessageError("Le message est trop long");
  }

  const conversation = await Conversation.findOne({
    _id: conversationId,
    participants: senderId,
  });
  if (!conversation) {
    throw new SendMessageError("Conversation introuvable");
  }

  const recipientId = conversation.participants.find(
    (p) => p.toString() !== senderId,
  );

  // Modération : aucun message ne passe si l'un des deux a bloqué l'autre.
  // Jusqu'ici le blocage ne faisait que masquer le fil côté bloqueur — la
  // personne bloquée pouvait continuer à écrire sans le savoir.
  // Le message n'est ni stocké ni notifié ; l'émetteur reçoit une erreur
  // générique, qui ne distingue pas « bloqué » de « conversation fermée ».
  if (recipientId && (await isBlockedBetween(senderId, recipientId))) {
    throw new SendMessageError("Cette conversation n'est plus disponible");
  }

  // Types structurés : métadonnées de coordination, jamais chiffrées.
  const STRUCTURED_TYPES = ["gift_share", "date_share"];
  const messageType = STRUCTURED_TYPES.includes(type) ? type : "text";
  const isStructured = STRUCTURED_TYPES.includes(messageType);

  const messageData = {
    conversation: conversationId,
    sender: senderId,
    content: content.trim(),
    type: messageType,
    readBy: [{ user: senderId }],
    ...(clientId ? { clientId: String(clientId).slice(0, 64) } : {}),
    isEncrypted: isStructured ? false : !!isEncrypted,
  };

  // Destinataire connecté : le message lui parvient en temps réel à
  // l'instant, il est donc distribué dès l'enregistrement.
  if (recipientId && isOnline(connectedUsers, recipientId)) {
    messageData.deliveredTo = [
      { user: recipientId, deliveredAt: new Date() },
    ];
  }

  if (isStructured && metadata) {
    messageData.metadata = metadata;
  }

  // Réponse à un message : vérifier qu'il appartient bien à la conversation
  if (replyTo) {
    const repliedMessage = await Message.findById(replyTo).select(
      "conversation",
    );
    if (
      repliedMessage &&
      repliedMessage.conversation.toString() === String(conversationId)
    ) {
      messageData.replyTo = replyTo;
    }
  }

  if (
    messageType === "text" &&
    isEncrypted &&
    encryptedForRecipient &&
    encryptedForSender
  ) {
    const encFor = {};
    if (recipientId) encFor[recipientId.toString()] = encryptedForRecipient;
    encFor[senderId] = encryptedForSender;
    if (Object.keys(encFor).length > 0) messageData.encryptedFor = encFor;
  }

  const message = new Message(messageData);
  await message.save();

  conversation.lastMessage = message._id;
  conversation.lastMessageAt = message.createdAt;
  await conversation.save();

  // ── Push notification ──────────────────────────────────────────────────
  // Chaque canal est coupé seulement par un socket du MÊME type :
  //   - app mobile au premier plan (socket "app") → pas de push Expo,
  //     le message arrive en temps réel dans l'app ;
  //   - onglet web ouvert (socket "web") → pas de web push.
  // Un onglet web ouvert ne doit JAMAIS empêcher le téléphone de sonner.
  const recipientAppOnline =
    !!recipientId && hasClient(connectedUsers, recipientId, "app");
  const recipientWebOnline =
    !!recipientId && hasClient(connectedUsers, recipientId, "web");
  const pushChannels = {
    skipExpo: recipientAppOnline,
    skipWeb: recipientWebOnline,
  };
  // TEMP diagnostic push multi-appareils — à retirer une fois validé
  if (recipientId) {
    console.log(
      `[push-presence] dest=${recipientId} sockets=${JSON.stringify(
        Object.fromEntries(connectedUsers.get(String(recipientId)) || []),
      )} skipExpo=${recipientAppOnline} skipWeb=${recipientWebOnline}`,
    );
  }
  if (recipientId && !(recipientAppOnline && recipientWebOnline)) {
    // publicKey nécessaire pour le déchiffrement sur l'appareil (façon WhatsApp)
    const sender = await User.findById(
      senderId,
      "name surname publicKey",
    );
    const senderName = sender
      ? `${sender.name} ${sender.surname || ""}`.trim()
      : "Quelqu'un";

    if (
      messageType === "text" &&
      isEncrypted &&
      encryptedForRecipient &&
      sender?.publicKey
    ) {
      // 🔓 Notif lisible côté appareil : on envoie le CHIFFRÉ, jamais le texte.
      // Le mobile déchiffre localement avec sa clé privée (Keychain/Keystore).
      sendPushToUser(recipientId, {
        ...pushChannels,
        dataOnly: true,
        type: "chat",
        encrypted: true,
        cipher: encryptedForRecipient,
        senderPublicKey: sender.publicKey,
        senderName,
        conversationId,
        // messageId + jeton : l'appareil accuse « distribué » à la réception
        ...deliveryReceiptFields(message._id, recipientId),
        url: `/home?tab=chat&conversationId=${conversationId}`,
        tag: `chat-${conversationId}`,
        // Permet à ce destinataire d'avoir mis CETTE conversation en
        // silencieux, sans couper toutes ses notifications de chat.
        muteScope: { kind: "dm", id: conversationId },
        friendId: senderId,
        // Fallback affiché si déchiffrement impossible / iOS sans NSE :
        title: `💬 ${senderName}`,
        body: "🔒 Nouveau message chiffré",
      }).catch((err) => console.error("❌ Push chat error:", err));
    } else {
      // Cas non chiffrés (gift_share, date_share, chat en clair).
      let pushBody;
      if (messageType === "gift_share") {
        const personName = metadata?.personName || "quelqu'un";
        pushBody = `🎁 Idées cadeaux pour ${personName}`;
      } else if (messageType === "date_share") {
        const personName = metadata?.personName || "quelqu'un";
        pushBody = `🎂 Anniversaire de ${personName}`;
      } else {
        pushBody = content.trim().slice(0, 100);
      }

      sendPushToUser(recipientId, {
        ...pushChannels,
        title: `💬 ${senderName}`,
        body: pushBody,
        url: `/home?tab=chat&conversationId=${conversationId}`,
        tag: `chat-${conversationId}`,
        // Permet à ce destinataire d'avoir mis CETTE conversation en
        // silencieux, sans couper toutes ses notifications de chat.
        muteScope: { kind: "dm", id: conversationId },
        type: "chat",
        friendId: senderId,
        conversationId,
        ...deliveryReceiptFields(message._id, recipientId),
      }).catch((err) => console.error("❌ Push chat error:", err));
    }
  }

  // ── Notif applicative si le destinataire n'a pas la conversation ouverte ──
  if (recipientId) {
    const conversationRoom = io.sockets.adapter.rooms.get(
      `conversation:${conversationId}`,
    );
    // Le destinataire n'est dans la room depuis AUCUN de ses appareils
    // = messages non lus
    const recipientInConversation =
      !!conversationRoom &&
      socketIdsOf(connectedUsers, recipientId).some((id) =>
        conversationRoom.has(id),
      );

    if (!recipientInConversation) {
      const sender = await User.findById(senderId, "name surname");
      const senderName = sender
        ? `${sender.name} ${sender.surname || ""}`.trim()
        : "Quelqu'un";

      let preview;
      if (messageType === "gift_share") {
        preview = `🎁 Idées cadeaux pour ${metadata?.personName || "quelqu'un"}`;
      } else if (messageType === "date_share") {
        preview = `🎂 Anniversaire de ${metadata?.personName || "quelqu'un"}`;
      } else if (isEncrypted) {
        preview = "🔒 Message chiffré";
      } else {
        preview = content.trim().slice(0, 60);
      }

      console.log("🔔 app défini ?", !!app, "type:", typeof app);

      notify(app, {
        userId: recipientId,
        type: "new_message",
        data: {
          senderName,
          preview,
          conversationId,
        },
        link: `/home?tab=chat&conversationId=${conversationId}`,
      }).catch((err) => console.error("❌ Notify chat error:", err));
    }
  }

  await message.populate("sender", "name surname email publicKey");

  console.log(
    `💬 Message [${messageType}] sent in conversation ${conversationId}`,
  );

  return { message: toSerializable(message.toObject()), duplicate: false };
}

module.exports = { sendDirectMessage, SendMessageError };
