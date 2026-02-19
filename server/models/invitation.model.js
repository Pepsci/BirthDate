const mongoose = require("mongoose");

const invitationSchema = new mongoose.Schema({
  email: { type: String, required: true }, // email invité
  invitedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  }, // qui invite
  token: { type: String, required: true, unique: true },
  status: { type: String, enum: ["pending", "accepted"], default: "pending" },
  createdAt: { type: Date, default: Date.now, expires: 60 * 60 * 24 * 30 }, // expire après 30 jours
});

module.exports = mongoose.model("Invitation", invitationSchema);
