const Notification = require("../models/notification.model");

/**
 * Crée une notification en base et l'émet en temps réel via Socket.io.
 * Pour le type "new_message" : met à jour la notif existante non lue
 * pour la même conversation plutôt que d'en créer une nouvelle.
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

  // Déduplication pour les messages : une seule notif par conversation
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
