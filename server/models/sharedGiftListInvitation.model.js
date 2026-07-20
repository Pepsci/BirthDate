const mongoose = require("mongoose");
const { Schema } = mongoose;

/**
 * Invitation à créer/rejoindre une liste de cadeaux commune.
 * L'initiateur choisit un ami et sa propre carte (fromDate).
 * Le destinataire accepte en choisissant sa carte (toDate) → la liste est créée/liée.
 */
const sharedGiftListInvitationSchema = new Schema(
  {
    fromUser: { type: Schema.Types.ObjectId, ref: "User", required: true },
    toUser: { type: Schema.Types.ObjectId, ref: "User", required: true },
    fromDate: { type: Schema.Types.ObjectId, ref: "Date", required: true },
    // Liste existante à rejoindre (si l'initiateur en a déjà une), sinon créée à l'acceptation
    sharedGiftList: {
      type: Schema.Types.ObjectId,
      ref: "SharedGiftList",
      default: null,
    },
    label: { type: String, default: null },
    // Mode de partage choisi à l'invitation :
    //  - "full"      : toutes les idées de la carte fromDate sont partagées
    //  - "selective" : seules les idées listées dans giftIds le sont
    shareMode: {
      type: String,
      enum: ["full", "selective"],
      default: "full",
    },
    // Ids des sous-documents Date.gifts à partager (mode "selective")
    giftIds: [{ type: Schema.Types.ObjectId }],
    status: {
      type: String,
      enum: ["pending", "accepted", "declined"],
      default: "pending",
    },
  },
  { timestamps: true },
);

sharedGiftListInvitationSchema.index({ toUser: 1, status: 1 });

module.exports = mongoose.model(
  "SharedGiftListInvitation",
  sharedGiftListInvitationSchema,
);
