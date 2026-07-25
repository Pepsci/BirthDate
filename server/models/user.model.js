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

  // ── Wishlist publique ──────────────────────────────────────────
  wishlistPublic: {
    type: Boolean,
    default: false,
  },
  wishlistPublicSlug: {
    type: String,
    // Pas de `default: null` : le champ reste absent tant que l'utilisateur
    // n'a pas activé le partage de sa wishlist (le slug est généré à ce
    // moment-là dans routes/wishlist.js). Un `default: null` casserait
    // l'index unique (tous les null sont considérés comme des doublons).
    index: {
      unique: true,
      // Unique uniquement quand le slug est une vraie chaîne. Les documents
      // sans slug (inscription) ne sont pas indexés → pas de collision.
      partialFilterExpression: { wishlistPublicSlug: { $type: "string" } },
    },
  },
  wishlistFriendCode: {
    type: String,
    default: null,
  },

  // ── Emails anniversaires ───────────────────────────────────────────────────
  receiveBirthdayEmails: { type: Boolean, default: true },
  receiveFriendRequestEmails: { type: Boolean, default: true },
  receiveOwnBirthdayEmail: { type: Boolean, default: true },

  // ── Récap mensuel ────────────────────────────────────────────────────────
  monthlyRecap: { type: Boolean, default: false },

  // ── Réglages d'affichage ──────────────────────────────────────────────────
  // Cacher les fêtes (namedays) sur les cartes d'anniversaire.
  hideNamedaysOnCards: { type: Boolean, default: false },

  // ── Compte ────────────────────────────────────────────────────────────────
  deletedAt: Date,

  // ── Modération (conformité stores : Apple 1.2 / Google UGC) ───────────────
  blockedUsers: {
    type: [{ type: Schema.Types.ObjectId, ref: "User" }],
    default: [],
  },
  acceptedTermsAt: Date,

  // ── Rôle (admin) ────────────────────────────────────────────────────────────
  role: {
    type: String,
    enum: ["user", "admin"],
    default: "user",
  },

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

  // ── Notifications emails événements ───────────────────────────────────────
  receiveEventEmails: { type: Boolean, default: true },
  eventEmailTimings: {
    type: [Number],
    default: [1],
  },

  // ── Push notifications ─────────────────────────────────────────────────────
  pushEnabled: { type: Boolean, default: false },
  // Tokens Expo Push (app mobile) — un par appareil
  expoPushTokens: { type: [String], default: [] },
  // Sous-ensemble des tokens ci-dessus appartenant à des appareils iOS.
  // iOS throttle les pushes silencieuses → on leur envoie des notifs alerte.
  expoPushTokensIos: { type: [String], default: [] },
  pushEvents: {
    birthdays: { type: Boolean, default: true },
    chat: { type: Boolean, default: true },
    friends: { type: Boolean, default: true },
    gifts: { type: Boolean, default: true },
    events: { type: Boolean, default: true },
  },
  pushBirthdayTimings: {
    type: [Number],
    default: [1, 0],
  },
  pushEventTimings: {
    type: [Number],
    default: [1],
  },

  // ── Chiffrement E2E ────────────────────────────────────────────────────────
  publicKey: { type: String, default: null },
  encryptedPrivateKey: { type: String, default: null },
  oldPublicKey: { type: String, default: null },
  oldEncryptedPrivateKey: { type: String, default: null },
  encryptedSeedPhrase: { type: String, default: null },
  e2eMode: { type: String, enum: ["standard", "full"], default: "standard" },
  e2eActivatedAt: { type: Date, default: null },
});

const UserModel = model("User", userSchema);

module.exports = UserModel;
