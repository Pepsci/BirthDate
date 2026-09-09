const mongoose = require("mongoose");
const { Schema } = mongoose;

const eventInvitationSchema = new Schema(
  {
    event: {
      type: Schema.Types.ObjectId,
      ref: "Event",
      required: true,
    },
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null, // null si invité externe
    },
    externalEmail: String, // si non inscrit
    guestName: String, // si non inscrit
    status: {
      type: String,
      enum: ["pending", "accepted", "declined", "maybe"],
      default: "pending",
    },
    dateVote: [Date], // votes sur les dates proposées
    locationVote: {
      type: Schema.Types.ObjectId, // Référence optionnelle avec un _id généré dans locationOptions, ou on peut utiliser un ObjectID généré s'il y a des objets. Pour la simplicité, utilisons les ids du Mongoose subdocument
    },
    joinedViaCode: {
      type: Boolean,
      default: false,
    },

    guestToken: {
      type: String,
      default: null,
      index: true,
    },

    /**
     * Notifications que CE participant accepte de recevoir pour CET
     * événement. Tout est activé par défaut : personne ne doit avoir à
     * configurer quoi que ce soit pour que l'application marche.
     *
     * ⚠️ Le champ existait déjà dans une route (PUT .../notifications) mais
     * pas dans ce schéma : Mongoose le supprimait en silence, et la route ne
     * faisait donc rien. Elle était de surcroît réservée à l'organisateur —
     * un invité ne pouvait pas régler ses propres notifications.
     *
     * Ne couvre QUE ce qu'un participant reçoit réellement. Les réponses aux
     * invitations, les votes, les cadeaux proposés et les contributions ne
     * partent qu'à l'organisateur : ses réglages à lui vivent sur
     * l'événement (`organizerNotificationPrefs`).
     *
     * Volontairement absentes d'ici : l'annulation et le changement de date.
     * Ce sont les deux seules dont l'utilité est de rattraper quelqu'un qui
     * ne regarde pas l'application ; les couper, c'est se déplacer pour rien.
     */
    notificationPreferences: {
      chatMessage: { type: Boolean, default: true },
      eventUpdates: { type: Boolean, default: true },
    },
  },
  { timestamps: true },
);

// Indexes
eventInvitationSchema.index({ event: 1, user: 1 });
eventInvitationSchema.index({ event: 1, externalEmail: 1 });

module.exports = mongoose.model("EventInvitation", eventInvitationSchema);
