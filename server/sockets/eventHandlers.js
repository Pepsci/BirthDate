const Event = require("../models/event.model");
const EventMessage = require("../models/eventMessage.model");
const EventInvitation = require("../models/eventInvitation.model");
const User = require("../models/user.model");
const { notify } = require("../utils/notify");

module.exports = (io, socket, app) => {
  socket.on("event:join", async ({ shortId }) => {
    try {
      const event = await Event.findOne({ shortId });
      if (event) {
        socket.join(`event:${shortId}`);
        console.log(`✅ User ${socket.userId} joined event ${shortId}`);
        if (socket.userId) {
          await EventMessage.updateMany(
            {
              event: event._id,
              sender: { $ne: socket.userId },
              "readBy.user": { $ne: socket.userId },
            },
            { $push: { readBy: { user: socket.userId, readAt: new Date() } } },
          );
          socket
            .to(`event:${shortId}`)
            .emit("event:messages_read", { shortId, userId: socket.userId });
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
    const {
      shortId,
      content,
      isEncrypted,
      encryptedFor: encryptedForMap,
      tempId,
    } = data;
    try {
      if (!content || content.trim().length === 0) {
        return socket.emit("event:message_error", {
          tempId,
          error: "Le message ne peut pas être vide",
        });
      }
      const maxLength = isEncrypted ? 50000 : 2000;
      if (content.trim().length > maxLength) {
        return socket.emit("event:message_error", {
          tempId,
          error: "Le message est trop long",
        });
      }
      const event = await Event.findOne({ shortId });
      if (!event)
        return socket.emit("event:message_error", {
          tempId,
          error: "Événement introuvable",
        });
      if (!socket.userId)
        return socket.emit("event:message_error", {
          tempId,
          error: "Non autorisé",
        });

      const messageData = {
        event: event._id,
        sender: socket.userId,
        content: content.trim(),
        readBy: [{ user: socket.userId, readAt: new Date() }],
        isEncrypted: !!isEncrypted,
      };

      if (
        isEncrypted &&
        encryptedForMap &&
        typeof encryptedForMap === "object"
      ) {
        messageData.encryptedFor = encryptedForMap;
      }

      const message = new EventMessage(messageData);
      await message.save();
      await message.populate("sender", "name surname email avatar publicKey");
      console.log(`💬 Event message saved for event ${shortId}`);

      const toSerializable = (msgObj) => {
        if (msgObj.encryptedFor instanceof Map) {
          msgObj.encryptedFor = Object.fromEntries(msgObj.encryptedFor);
        }
        return msgObj;
      };

      socket.emit("event:message_new", {
        shortId,
        message: toSerializable({ ...message.toObject(), tempId }),
      });
      socket.to(`event:${shortId}`).emit("event:message_new", {
        shortId,
        message: toSerializable(message.toObject()),
      });

      // Notifications pour les participants absents de la room
      if (app) {
        try {
          const eventWithPrefs = await Event.findOne({ shortId }).select(
            "organizerNotificationPrefs",
          );
          const chatNotifEnabled =
            eventWithPrefs?.organizerNotificationPrefs?.event_chat_message !==
            false;

          if (chatNotifEnabled) {
            const sender = await User.findById(socket.userId, "name surname");
            const senderName = sender
              ? `${sender.name}${sender.surname ? " " + sender.surname : ""}`
              : "Quelqu'un";

            const invitations = await EventInvitation.find({
              event: event._id,
              user: { $nin: [null, socket.userId] },
              status: { $in: ["accepted", "pending"] },
            }).select("user");

            const roomSockets = await io.in(`event:${shortId}`).allSockets();
            const onlineUserIds = new Set();
            for (const socketId of roomSockets) {
              const s = io.sockets.sockets.get(socketId);
              if (s?.userId) onlineUserIds.add(s.userId.toString());
            }

            for (const invitation of invitations) {
              const participantId = invitation.user.toString();
              if (onlineUserIds.has(participantId)) continue;

              await notify(app, {
                userId: participantId,
                type: "event_chat_message",
                data: {
                  eventShortId: event.shortId,
                  eventTitle: event.title,
                  senderName,
                  preview: isEncrypted
                    ? "Message chiffré 🔒"
                    : content.trim().slice(0, 60) +
                      (content.trim().length > 60 ? "…" : ""),
                },
                link: `/event/${event.shortId}`,
              });
            }
          }
        } catch (notifError) {
          console.error(
            "❌ Error sending event chat notifications:",
            notifError,
          );
        }
      }
    } catch (error) {
      console.error("❌ Error sending event message:", error);
      socket.emit("event:message_error", {
        tempId,
        error: "Impossible d'envoyer le message",
      });
    }
  });

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
