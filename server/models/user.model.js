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
  // "auto" = calculée depuis le calendrier (suit ses corrections),
  // "manual" = choisie par l'utilisateur (jamais recalculée). Voir resolveNameday().
  namedaySource: { type: String, enum: ["auto", "manual"], default: "auto" },
  resetToken: String,
  resetTokenExpires: Date,
  verificationToken: String, // hash SHA-256 (anciens comptes : token en clair)
  verificationTokenExpires: Date,
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

  // ── Emails fêtes (namedays) — indépendant des emails d'anniversaire ────────
  receiveNamedayEmails: { type: Boolean, default: true },

  // ── Récap mensuel ────────────────────────────────────────────────────────
  monthlyRecap: { type: Boolean, default: false },

  // ── Réglages d'affichage ──────────────────────────────────────────────────
  // Cacher les fêtes (namedays) sur les cartes d'anniversaire.
  hideNamedaysOnCards: { type: Boolean, default: false },
  // Afficher le bandeau "C'est la fête de X !" sur l'écran d'accueil.
  showTodayNamedayOnHome: { type: Boolean, default: true },

  // ── Compte ────────────────────────────────────────────────────────────────
  deletedAt: Date,
  // Tout token émis AVANT cette date est refusé (utils/session.js) : changer
  // ou réinitialiser son mot de passe déconnecte donc les autres appareils.
  passwordChangedAt: { type: Date, default: null },

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

  // ── Quota d'événements (réglé par un admin) ────────────────────────────────
  // null = valeur par défaut de services/quotas.js (5 créations par 24 h,
  // 15 événements en cours). Renseigné depuis la fiche utilisateur de l'admin
  // quand quelqu'un demande au support à en créer davantage.
  eventQuota: {
    daily: { type: Number, default: null },
    active: { type: Number, default: null },
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

  // ── Suivi plateforme / version (admin — support & débogage) ────────────────
  // Mis à jour à chaque connexion (voir routes/auth.js) et, côté mobile, à
  // chaque enregistrement du token push (voir routes/push.js).
  lastPlatform: {
    type: String,
    enum: ["web", "ios", "android", null],
    default: null,
  },
  lastAppVersion: { type: String, default: null },
  lastSeenAt: { type: Date, default: null },

  // ── Langue ─────────────────────────────────────────────────────────────────
  // Langue dans laquelle le serveur écrit à ce compte : notifications push,
  // emails, rappels des crons. Envoyée par l'app mobile sans rien demander à
  // l'utilisateur (langue du téléphone, ou choix dans Profil) — voir
  // PATCH /users/me/language et server/i18n/index.js.
  // `null` (tous les comptes d'avant, et le site web) = français.
  language: {
    type: String,
    enum: ["fr", "en", null],
    default: null,
  },
  pushEvents: {
    birthdays: { type: Boolean, default: true },
    // Les fêtes (namedays) suivaient l'interrupteur `birthdays` : impossible de
    // garder les anniversaires sans les fêtes. Catégorie propre, activée par
    // défaut pour ne rien couper chez les comptes existants.
    namedays: { type: Boolean, default: true },
    // Activité des listes de cadeaux communes (ajout, modification, retrait
    // d'une idée, départ d'un membre). Catégorie propre : elle suivait
    // « Cadeaux », qui couvre les réservations sur les wishlists — deux usages
    // assez différents pour mériter chacun son interrupteur.
    sharedLists: { type: Boolean, default: true },
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
