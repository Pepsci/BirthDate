const { Schema, model } = require("mongoose");

const userSchema = new Schema({
  name: { type: String, required: true },
  email: { type: String, unique: true, required: true },
  password: { type: String, required: true },
  surname: String,
  avatar: {
    type: String,
    default:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ac/No_image_available.svg/480px-No_image_available.svg.png",
  },
  birthDate: Date,
  nameday: {
    type: String,
    required: false,
    validate: {
      validator: function (v) {
        if (!v) return true;
        return /^\d{2}-\d{2}$/.test(v);
      },
      message: "Nameday must be in MM-DD format",
    },
  },
  resetToken: String,
  resetTokenExpires: Date,
  verificationToken: String,
  isVerified: { type: Boolean, default: false },
  lastVerificationEmailSent: Date,

  // ── Emails anniversaires ───────────────────────────────────────────────────
  receiveBirthdayEmails: { type: Boolean, default: true },
  receiveFriendRequestEmails: { type: Boolean, default: true },
  receiveOwnBirthdayEmail: { type: Boolean, default: true },

  // ── Récap mensuel (NOUVEAU) ────────────────────────────────────────────────
  monthlyRecap: { type: Boolean, default: false },

  // ── Compte ────────────────────────────────────────────────────────────────
  deletedAt: Date,

  // ── Onboarding ─────────────────────────────────────────────────────────────
  onboardingDone: { type: Boolean, default: false },

  // ── Notifications emails chat ──────────────────────────────────────────────
  receiveChatEmails: { type: Boolean, default: true },
  chatEmailFrequency: {
    type: String,
    enum: ["instant", "twice_daily", "daily", "weekly"],
    default: "daily",
  },
  chatEmailDisabledFriends: {
    type: [{ type: Schema.Types.ObjectId, ref: "User" }],
    default: [],
  },
  lastChatEmailSent: { type: Date, default: null },

  // ── Push notifications ─────────────────────────────────────────────────────
  pushEnabled: { type: Boolean, default: false },
  pushEvents: {
    birthdays: { type: Boolean, default: true },
    chat: { type: Boolean, default: true },
    friends: { type: Boolean, default: true },
    gifts: { type: Boolean, default: true },
  },
  pushBirthdayTimings: {
    type: [Number],
    default: [1, 0],
  },

  // ── Chiffrement E2E ────────────────────────────────────────────────────────
  publicKey: { type: String, default: null },
  encryptedPrivateKey: { type: String, default: null },
  // Ancienne paire de clés — conservée lors d'un changement de mode E2E
  // pour permettre de déchiffrer les messages émis avant le changement
  oldPublicKey: { type: String, default: null },
  oldEncryptedPrivateKey: { type: String, default: null },
  // Seed phrase BIP39 chiffrée (uniquement en mode Full E2E)
  encryptedSeedPhrase: { type: String, default: null },
  e2eMode: { type: String, enum: ["standard", "full"], default: "standard" },
  e2eActivatedAt: { type: Date, default: null },
});

const UserModel = model("User", userSchema);

module.exports = UserModel;
