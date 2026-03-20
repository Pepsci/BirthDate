const Event = require("../models/event.model");
const EventMessage = require("../models/eventMessage.model");
const User = require("../models/user.model");

module.exports = (io, socket) => {

  socket.on("event:join", async ({ shortId }) => {
    try {
      const event = await Event.findOne({ shortId });
      if (event) {
        socket.join(`event:${shortId}`);
        console.log(`✅ User ${socket.userId} joined event ${shortId}`);
        if (socket.userId) {
          await EventMessage.updateMany(
            { event: event._id, sender: { $ne: socket.userId }, "readBy.user": { $ne: socket.userId } },
            { $push: { readBy: { user: socket.userId, readAt: new Date() } } }
          );
          socket.to(`event:${shortId}`).emit("event:messages_read", { shortId, userId: socket.userId });
        }
      }
    } catch (error) {
      console.error("❌ Error joining event room:", error);
    }
  });

  socket.on("event:leave", ({ shortId }) => {
    socket.leave(`event:${shortId}`);
    console.log(`👋 User ${socket.userId} left event ${shortId}`);
  });

  socket.on("event:message_send", async (data) => {
    const { shortId, content, tempId } = data;
    try {
      if (!content || content.trim().length === 0) {
        return socket.emit("event:message_error", { tempId, error: "Le message ne peut pas être vide" });
      }
      const event = await Event.findOne({ shortId });
      if (!event) return socket.emit("event:message_error", { tempId, error: "Événement introuvable" });
      if (!socket.userId) return socket.emit("event:message_error", { tempId, error: "Non autorisé" });

      const message = new EventMessage({
        event: event._id,
        sender: socket.userId,
        content: content.trim(),
        readBy: [{ user: socket.userId, readAt: new Date() }],
      });
      await message.save();
      await message.populate("sender", "name surname email avatar");
      console.log(`💬 Event message saved for event ${shortId}`);

      socket.emit("event:message_new", { shortId, message: { ...message.toObject(), tempId } });
      socket.to(`event:${shortId}`).emit("event:message_new", { shortId, message: message.toObject() });
    } catch (error) {
      console.error("❌ Error sending event message:", error);
      socket.emit("event:message_error", { tempId, error: "Impossible d'envoyer le message" });
    }
  });

  // NOUVEAU : indicateur de frappe
  socket.on("event:typing_start", async ({ shortId }) => {
    if (!socket.userId) return;
    try {
      const user = await User.findById(socket.userId, "name surname");
      const userName = user ? `${user.name}` : "Quelqu'un";
      socket.to(`event:${shortId}`).emit("event:typing_start", {
        shortId,
        userId: socket.userId,
        userName,
      });
    } catch (err) {
      console.error("❌ Error typing start:", err);
    }
  });

  socket.on("event:typing_stop", ({ shortId }) => {
    if (!socket.userId) return;
    socket.to(`event:${shortId}`).emit("event:typing_stop", {
      shortId,
      userId: socket.userId,
    });
  });

  socket.on("event:rsvp_updated", ({ shortId }) => {
    socket.to(`event:${shortId}`).emit("event:rsvp_update", { shortId });
  });

  socket.on("event:vote_updated", ({ shortId }) => {
    socket.to(`event:${shortId}`).emit("event:vote_update", { shortId });
  });

  socket.on("event:gift_proposed", ({ shortId }) => {
    socket.to(`event:${shortId}`).emit("event:gift_proposal", { shortId });
  });

  socket.on("event:guest_joined", ({ shortId }) => {
    socket.to(`event:${shortId}`).emit("event:guest_joined", { shortId });
  });
};