const Notification = require("../models/notification.model");
const User = require("../models/user.model");
const { sendPushToUser } = require("../services/pushService");

/**
 * Crée une notification en base et l'émet en temps réel via Socket.io.
 * Envoie également une push notification si l'utilisateur l'a activée.
 * - "new_message" : déduplique par conversationId
 * - "event_chat_message" : déduplique par eventShortId
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
          type: "events",
        });
      }
    } catch (pushErr) {
      console.error("❌ Push event_chat_message failed:", pushErr);
    }
  }

  return notif;
};

module.exports = { notify };
