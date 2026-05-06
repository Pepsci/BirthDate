const Notification = require("../models/notification.model");

/**
 * Crée une notification en base et l'émet en temps réel via Socket.io.
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

    console.log("🔔 existing notif:", !!existing);

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

  console.log(
    "🔔 émission sur room:",
    `user:${userId}`,
    "notif._id:",
    notif._id,
  );

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

  return notif;
};

module.exports = { notify };
