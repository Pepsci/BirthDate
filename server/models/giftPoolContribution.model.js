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
  },
  { timestamps: true },
);

module.exports = model("GiftPoolContribution", giftPoolContributionSchema);
