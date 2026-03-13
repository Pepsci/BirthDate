const mongoose = require("mongoose");

const pushSubscriptionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  },
  subscription: {
    endpoint: { type: String, required: true },
    keys: {
      p256dh: { type: String, required: true },
      auth: { type: String, required: true },
    },
  },
  userAgent: { type: String }, // pour distinguer desktop/mobile
  createdAt: { type: Date, default: Date.now },
});

// Index unique : un user peut avoir plusieurs appareils mais pas 2x le même endpoint
pushSubscriptionSchema.index(
  { user: 1, "subscription.endpoint": 1 },
  { unique: true },
);

module.exports = mongoose.model("PushSubscription", pushSubscriptionSchema);
