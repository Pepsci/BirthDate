const { Schema, model } = require("mongoose");

/**
 * Signalement de contenu / d'utilisateur (conformité Apple 1.2 & Google UGC).
 * Les messages étant chiffrés E2E, le serveur ne peut pas lire le contenu :
 * `contentPreview` est fourni (déchiffré) par le client qui signale.
 */
const reportSchema = new Schema(
  {
    reporter: { type: Schema.Types.ObjectId, ref: "User", required: true },
    targetUser: { type: Schema.Types.ObjectId, ref: "User", default: null },
    contentType: {
      type: String,
      enum: ["message", "eventMessage", "giftProposal", "wishlist", "user", "other"],
      required: true,
    },
    contentId: { type: Schema.Types.ObjectId, default: null },
    contentPreview: { type: String, maxlength: 2000, default: "" },
    reason: {
      type: String,
      enum: ["spam", "harassment", "inappropriate", "scam", "other"],
      required: true,
    },
    details: { type: String, maxlength: 2000, default: "" },
    status: {
      type: String,
      enum: ["pending", "reviewed", "actioned", "dismissed"],
      default: "pending",
    },
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    reviewedAt: Date,
  },
  { timestamps: true },
);

reportSchema.index({ status: 1, createdAt: -1 });
reportSchema.index({ targetUser: 1 });

module.exports = model("Report", reportSchema);
