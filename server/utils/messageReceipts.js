/**
 * Accusés de réception des messages privés : distribué, lu.
 *
 * - « distribué » : le message a atteint un appareil du destinataire. Il est
 *   écrit dès l'envoi si le destinataire a un socket ouvert, sinon à sa
 *   prochaine connexion.
 * - « lu » : le `readBy` existant.
 *
 * Les événements partent vers la room `user:<id>` de chaque AUTRE participant
 * (rejointe par tout socket à la connexion, voir bin/www) et non vers la room
 * de la conversation : sur mobile, celle-ci n'est rejointe que lorsque l'écran
 * du chat est ouvert, et l'accusé serait perdu.
 *
 * Payload : { conversationId, userId, at } — `userId` est la personne qui a
 * reçu ou lu, `at` l'horodatage serveur (ISO).
 */
const Conversation = require("../models/conversation.model");
const Message = require("../models/message.model");

// Au-delà, un message non distribué n'intéresse plus personne, et la borne
// permet d'utiliser l'index { conversation, createdAt }.
const DELIVERY_LOOKBACK_MS = 30 * 24 * 60 * 60 * 1000;

function emitReceipt(io, event, conversation, userId, at) {
  if (!io || !conversation) return;
  for (const participant of conversation.participants || []) {
    const pid = String(participant._id ?? participant);
    if (pid === String(userId)) continue;
    io.to(`user:${pid}`).emit(event, {
      conversationId: String(conversation._id),
      userId: String(userId),
      at: at.toISOString(),
    });
  }
}

/**
 * Marque comme distribués tous les messages en attente pour `userId`
 * (non lus, non distribués, récents), puis prévient les expéditeurs.
 */
async function markDeliveredForUser(io, userId) {
  const conversations = await Conversation.find({ participants: userId })
    .select("_id participants")
    .lean();
  if (!conversations.length) return 0;

  const pending = {
    conversation: { $in: conversations.map((c) => c._id) },
    createdAt: { $gt: new Date(Date.now() - DELIVERY_LOOKBACK_MS) },
    sender: { $ne: userId },
    // Un message déjà lu n'a pas besoin d'être « distribué » : le lu l'emporte.
    "readBy.user": { $ne: userId },
    "deliveredTo.user": { $ne: userId },
  };

  const affected = (await Message.distinct("conversation", pending)).map(String);
  if (!affected.length) return 0;

  const deliveredAt = new Date();
  const result = await Message.updateMany(pending, {
    $push: { deliveredTo: { user: userId, deliveredAt } },
  });

  conversations
    .filter((c) => affected.includes(String(c._id)))
    .forEach((c) =>
      emitReceipt(io, "messages:delivered", c, userId, deliveredAt),
    );

  return result.modifiedCount;
}

/*
 * ── Distribué via la notification push ──────────────────────────────────────
 *
 * App fermée, le destinataire n'a pas de socket : c'est l'appareil qui prévient
 * le serveur à la réception de la push (Notification Service Extension iOS,
 * tâche de fond Android, service worker web).
 *
 * L'extension iOS n'a pas accès au JWT de l'app. La push embarque donc un jeton
 * HMAC propre à (message, destinataire) : il ne permet QUE de marquer ce
 * message comme distribué pour cette personne, et rien d'autre.
 */
const crypto = require("crypto");

function receiptKey() {
  return crypto
    .createHash("sha256")
    .update(`delivery-receipt:${process.env.TOKEN_SECRET}`)
    .digest();
}

function createDeliveryToken(messageId, userId) {
  return crypto
    .createHmac("sha256", receiptKey())
    .update(`${messageId}:${userId}`)
    .digest("hex");
}

function verifyDeliveryToken(messageId, userId, token) {
  if (typeof token !== "string" || token.length !== 64) return false;
  const expected = Buffer.from(createDeliveryToken(messageId, userId), "hex");
  const given = Buffer.from(token, "hex");
  return given.length === expected.length && crypto.timingSafeEqual(given, expected);
}

/** Champs à ajouter à une push de message pour permettre l'accusé. */
function deliveryReceiptFields(messageId, userId) {
  const base = (process.env.BACKEND_URL || "http://localhost:4000").replace(/\/+$/, "");
  return {
    messageId: String(messageId),
    recipientId: String(userId),
    receiptToken: createDeliveryToken(messageId, userId),
    receiptUrl: `${base}/api/receipts/delivered`,
  };
}

/**
 * La push d'un message prouve que l'appareil a reçu celui-ci ET les précédents
 * de la conversation (chacun a eu sa push) : on les marque tous.
 */
async function markDeliveredFromPush(io, messageId, userId) {
  const Msg = Message;
  const message = await Msg.findById(messageId).select("conversation createdAt sender");
  if (!message || String(message.sender) === String(userId)) return 0;

  const conversation = await Conversation.findOne({
    _id: message.conversation,
    participants: userId,
  })
    .select("_id participants")
    .lean();
  if (!conversation) return 0;

  const deliveredAt = new Date();
  const result = await Msg.updateMany(
    {
      conversation: conversation._id,
      createdAt: { $lte: message.createdAt },
      sender: { $ne: userId },
      "readBy.user": { $ne: userId },
      "deliveredTo.user": { $ne: userId },
    },
    { $push: { deliveredTo: { user: userId, deliveredAt } } },
  );

  if (result.modifiedCount > 0) {
    emitReceipt(io, "messages:delivered", conversation, userId, deliveredAt);
  }
  return result.modifiedCount;
}

/** Prévient les autres participants que `userId` a lu la conversation. */
function emitRead(io, conversation, userId, readAt = new Date()) {
  emitReceipt(io, "messages:read", conversation, userId, readAt);
}

module.exports = {
  markDeliveredForUser,
  markDeliveredFromPush,
  verifyDeliveryToken,
  deliveryReceiptFields,
  emitRead,
};
