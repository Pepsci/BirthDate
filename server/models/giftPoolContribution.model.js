const { Schema, model } = require("mongoose");

const giftPoolContributionSchema = new Schema(
  {
    event: {
      type: Schema.Types.ObjectId,
      ref: "Event",
      required: true,
      index: true,
    },
    contributor: { type: Schema.Types.ObjectId, ref: "User", default: null }, // null = invité externe
    guestName: { type: String, trim: true },
    amount: { type: Number, required: true }, // centimes
    currency: { type: String, default: "eur" },
    message: { type: String, maxlength: 280, trim: true },
    anonymous: { type: Boolean, default: false },
    stripePaymentIntentId: { type: String, required: true, unique: true },
    status: {
      type: String,
      enum: ["pending", "succeeded", "failed", "refunded"],
      default: "pending",
    },

    // ── Remboursement ─────────────────────────────────────────────────────
    // Le passage en "refunded" est prononcé par le webhook `charge.refunded`,
    // jamais par la route qui déclenche le remboursement : Stripe reste la
    // source de vérité, exactement comme pour l'encaissement.
    stripeRefundId: { type: String, default: null },
    refundedAt: { type: Date, default: null },
    // Ce que l'opération coûte à l'ORGANISATEUR. Stripe ne restitue pas les
    // frais de la transaction d'origine : le contributeur récupère 100 % de sa
    // contribution, et l'écart reste à la charge de l'organisateur. On fige le
    // montant au moment du remboursement plutôt que de le recalculer plus
    // tard, car le barème peut changer.
    refundFeeLoss: { type: Number, default: null }, // centimes
  },
  { timestamps: true },
);

module.exports = model("GiftPoolContribution", giftPoolContributionSchema);
