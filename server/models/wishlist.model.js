const { Schema, model } = require("mongoose");

const wishlistSchema = Schema({
  // À qui appartient cet item
  userId: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },

  // Nom de l'item
  title: {
    type: String,
    required: [true, "Le titre est requis"],
    trim: true,
    maxlength: [100, "Le titre ne peut pas dépasser 100 caractères"],
  },

  // Prix (optionnel)
  price: {
    type: Number,
    min: [0, "Le prix ne peut pas être négatif"],
  },

  // Lien (optionnel)
  url: {
    type: String,
    trim: true,
  },

  // Image récupérée depuis l'URL
  image: {
    type: String,
    trim: true,
    default: null,
  },

  // Description récupérée depuis l'URL
  description: {
    type: String,
    trim: true,
    maxlength: [500, "La description ne peut pas dépasser 500 caractères"],
    default: null,
  },

  // Partage avec les amis inscrits
  isShared: {
    type: Boolean,
    default: false,
  },

  // Statut d'achat
  isPurchased: {
    type: Boolean,
    default: false,
  },

  // Qui l'a acheté (ami inscrit)
  purchasedBy: {
    type: Schema.Types.ObjectId,
    ref: "User",
    default: null,
  },

  purchasedAt: {
    type: Date,
    default: null,
  },

  // Réservation par un ami inscrit
  reservedBy: {
    type: Schema.Types.ObjectId,
    ref: "User",
    default: null,
  },

  reservedAt: {
    type: Date,
    default: null,
  },

  // ── Réservation par un guest sans compte (page publique) ──
  // Séparé de reservedBy pour ne pas casser la ref User existante
  reservedByGuest: {
    type: String,
    default: null,
  },

  // Dates
  createdAt: {
    type: Date,
    default: Date.now,
  },

  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

wishlistSchema.index({ userId: 1 });
wishlistSchema.index({ userId: 1, isPurchased: 1 });

wishlistSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

const WishlistModel = model("Wishlist", wishlistSchema);

module.exports = WishlistModel;
