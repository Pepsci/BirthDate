const Notification = require("../models/notification.model");
const User = require("../models/user.model");
const { sendPushToUser } = require("../services/pushService");
const { REACTION_PUSH_GLYPH } = require("../constants/reactions");

/**
 * Crée une notification en base et l'émet en temps réel via Socket.io.
 * Envoie également une push notification si l'utilisateur l'a activée.
 * - "new_message" : déduplique par conversationId
 * - "event_chat_message" : déduplique par eventShortId
 * - "message_reaction" : déduplique par messageId
 *
 * @param {Express.Application} app
 * @param {Object} opts
 * @param {string} opts.userId
 * @param {string} opts.type
 * @param {Object} opts.data
 * @param {string} opts.link
 */
const notify = async (app, { userId, type, data = {}, link = null }) => {
  let notif;

  // Déduplication messages DM : une seule notif non lue par conversation
  if (type === "new_message" && data.conversationId) {
    const existing = await Notification.findOne({
      userId,
      type: "new_message",
      read: false,
      "data.conversationId": data.conversationId,
    });

    if (existing) {
      existing.data = data;
      existing.link = link;
      existing.createdAt = new Date();
      await existing.save();
      notif = existing;
    }
  }

  // Déduplication messages event : une seule notif non lue par event
  if (type === "event_chat_message" && data.eventShortId) {
    const existing = await Notification.findOne({
      userId,
      type: "event_chat_message",
      read: false,
      "data.eventShortId": data.eventShortId,
    });

    if (existing) {
      existing.data = data;
      existing.link = link;
      existing.createdAt = new Date();
      await existing.save();
      notif = existing;
    }
  }

  /*
   * Déduplication des réactions : une seule notif non lue par message.
   *
   * ⚠️ Sans ça, un message d'événement que douze personnes aiment produit
   * douze lignes dans le centre de notifications — et douze pushes. La
   * dernière réaction écrase la précédente : on garde « quelqu'un a réagi à ce
   * message », qui est l'information utile, sans l'empilement.
   */
  if (type === "message_reaction" && data.messageId) {
    const existing = await Notification.findOne({
      userId,
      type: "message_reaction",
      read: false,
      "data.messageId": data.messageId,
    });

    if (existing) {
      existing.data = data;
      existing.link = link;
      existing.createdAt = new Date();
      await existing.save();
      notif = existing;
    }
  }

  if (!notif) {
    notif = await Notification.create({ userId, type, data, link });
  }

  // Émission Socket.io in-app
  const io = app?.get("io");
  if (io) {
    io.to(`user:${userId}`).emit("new_notification", {
      _id: notif._id,
      type: notif.type,
      data: notif.data,
      link: notif.link,
      read: false,
      createdAt: notif.createdAt,
    });
  }

  // Push notification pour event_chat_message
  if (type === "event_chat_message") {
    try {
      const user = await User.findById(userId).select("pushEnabled pushEvents");
      if (user?.pushEnabled && user?.pushEvents?.events) {
        await sendPushToUser(userId, {
          title: `💬 ${data.eventTitle || "Événement"}`,
          body: `${data.senderName} : ${data.preview || "Nouveau message"}`,
          url: `${process.env.FRONTEND_URL}${link || "/"}`,
          tag: `event-chat-${data.eventShortId}`,
          // Idem pour la discussion d'un événement : le silencieux vise CET
          // événement, pas la catégorie « événements » entière.
          muteScope: { kind: "event", id: data.eventShortId },
          type: "events",
        });
      }
    } catch (pushErr) {
      console.error("❌ Push event_chat_message failed:", pushErr);
    }
  }

  // Push notification pour event_pool_contribution
  if (type === "event_pool_contribution") {
    try {
      const user = await User.findById(userId).select("pushEnabled pushEvents");
      if (user?.pushEnabled && user?.pushEvents?.events) {
        await sendPushToUser(userId, {
          title: `💰 Nouvelle contribution — ${data.eventTitle || "Cagnotte"}`,
          body: `${data.contributorName} a participé : ${data.amountLabel || ""}`,
          url: `${process.env.FRONTEND_URL}${link || "/"}`,
          tag: `event-pool-${data.eventShortId}`,
          type: "events",
        });
      }
    } catch (pushErr) {
      console.error("❌ Push event_pool_contribution failed:", pushErr);
    }
  }

  /*
   * Push réaction.
   *
   * ⚠️ Le tag est propre à la réaction (`reaction-<messageId>`) et non à la
   * conversation : sinon une réaction remplacerait sur l'écran verrouillé la
   * notification d'un message pas encore lu.
   *
   * Aucun extrait du message : les contenus sont chiffrés de bout en bout et
   * le serveur ne peut pas les lire — il n'a d'ailleurs pas à le pouvoir.
   * « Pierre a réagi ❤️ à votre message » dit tout ce qu'il faut.
   *
   * `sendPushToUser` applique seul `pushEnabled`, la catégorie et le mode
   * silencieux de CETTE conversation : rien à revérifier ici.
   */
  if (type === "message_reaction") {
    try {
      const glyph = REACTION_PUSH_GLYPH[data.reaction] || "";
      const isEvent = Boolean(data.eventShortId);

      await sendPushToUser(userId, {
        title: isEvent
          ? `${glyph} ${data.eventTitle || "Événement"}`
          : `${glyph} ${data.reactorName || "Quelqu'un"}`,
        body: isEvent
          ? `${data.reactorName || "Quelqu'un"} a réagi à votre message`
          : "a réagi à votre message",
        url: `${process.env.FRONTEND_URL}${link || "/"}`,
        tag: `reaction-${data.messageId}`,
        muteScope: isEvent
          ? { kind: "event", id: data.eventShortId }
          : { kind: "dm", id: data.conversationId },
        type: isEvent ? "events" : "chat",
      });
    } catch (pushErr) {
      console.error("❌ Push message_reaction failed:", pushErr);
    }
  }

  return notif;
};

module.exports = { notify };
