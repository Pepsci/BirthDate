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
  },
  { timestamps: true },
);

// Indexes
eventInvitationSchema.index({ event: 1, user: 1 });
eventInvitationSchema.index({ event: 1, externalEmail: 1 });

module.exports = mongoose.model("EventInvitation", eventInvitationSchema);
