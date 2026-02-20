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
  resetToken: String,
  resetTokenExpires: Date,
  verificationToken: String,
  isVerified: { type: Boolean, default: false },
  lastVerificationEmailSent: Date,
  receiveBirthdayEmails: { type: Boolean, default: true },
  receiveFriendRequestEmails: { type: Boolean, default: true },
  receiveOwnBirthdayEmail: { type: Boolean, default: true },
  deletedAt: Date,

  /**
   * Champs à ajouter à ton schéma User Mongoose (user.model.js)
   * ─────────────────────────────────────────────────────────────
   * Colle ces lignes dans l'objet userSchema (aux côtés de receiveBirthdayEmails, etc.)
   */

  // ── Notifications emails chat ──────────────────────────────────────────────

  /** Activer/désactiver les emails de notification de messages chat */
  receiveChatEmails: {
    type: Boolean,
    default: true,
  },

  /**
   * Fréquence d'envoi des emails chat */
  chatEmailFrequency: {
    type: String,
    enum: ["instant", "twice_daily", "daily", "weekly"],
    default: "daily",
  },

  /**
   * Liste des IDs d'amis pour lesquels les emails chat sont désactivés.
   * Si un friendId est dans ce tableau, aucun email ne sera envoyé
   * pour ses messages, même si receiveChatEmails est true.
   */
  chatEmailDisabledFriends: {
    type: [{ type: Schema.Types.ObjectId, ref: "User" }],
    default: [],
  },

  /**
   * Timestamp du dernier email de notification chat envoyé.
   * Utilisé pour éviter les doublons en mode "instant".
   */
  lastChatEmailSent: {
    type: Date,
    default: null,
  },
});

const UserModel = model("User", userSchema);

module.exports = UserModel;
