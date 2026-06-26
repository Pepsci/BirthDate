const { Schema, model } = require("mongoose");

const stripeAccountSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    stripeAccountId: { type: String, required: true },
    chargesEnabled: { type: Boolean, default: false },
    payoutsEnabled: { type: Boolean, default: false },
    detailsSubmitted: { type: Boolean, default: false },
    onboardingCompletedAt: { type: Date },
  },
  { timestamps: true },
);

module.exports = model("StripeAccount", stripeAccountSchema);
