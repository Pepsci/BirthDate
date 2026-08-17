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
        "nameday_soon",
        "gift_reserved",
        "event_reminder",
        // "event_reminder" servait aussi aux modifications d'événement : le
        // centre de notifications affichait « Rappel : … » là où la push disait
        // « Événement modifié ». Ces deux types lèvent l'ambiguïté.
        "event_updated",
        "event_date_changed",
        "event_rsvp",
        "event_date_vote",
        "event_location_vote",
        "event_gift_proposed",
        "event_gift_vote",
        "event_chat_message",
        "event_pool_contribution",
        "shared_gift_invite",
        "shared_gift_accepted",
        // Activité dans une liste commune : sans ces types, un membre pouvait
        // acheter un cadeau qu'un autre avait déjà marqué comme acheté.
        "shared_gift_added",
        "shared_gift_updated",
        "shared_gift_removed",
        "shared_gift_member_left",
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
