const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: [
        "friend_request",
        "friend_accepted",
        "new_message",
        "birthday_soon",
        "gift_reserved",
        "event_reminder",
      ],
      required: true,
    },
    // Données contextuelles : nom, aperçu message, etc.
    data: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    // Lien de navigation au clic (ex: "/friends", "/?tab=date&dateId=xxx")
    link: {
      type: String,
      default: null,
    },
    read: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true },
);

// Index composé pour les requêtes courantes (notifs d'un user triées par date)
notificationSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model("Notification", notificationSchema);
