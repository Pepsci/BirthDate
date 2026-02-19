const { Schema, model } = require("mongoose");

// Wishlist ultra-simple
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

  // Image récupérée depuis l'URL (on stocke juste le lien, pas le fichier)
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

  // Partage : simple ON/OFF
  isShared: {
    type: Boolean,
    default: false,
    // false = privé (personne ne voit)
    // true = partagé (tous mes contacts peuvent voir)
  },

  // Statut d'achat
  isPurchased: {
    type: Boolean,
    default: false,
  },

  // Qui l'a acheté
  purchasedBy: {
    type: Schema.Types.ObjectId,
    ref: "User",
    default: null,
  },

  // Quand ça a été acheté
  purchasedAt: {
    type: Date,
    default: null,
  },

  reservedBy: {
    type: Schema.Types.ObjectId,
    ref: "User",
    default: null,
  },

  reservedAt: {
    type: Date,
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

// Index pour optimiser les recherches
wishlistSchema.index({ userId: 1 });
wishlistSchema.index({ userId: 1, isPurchased: 1 });

// Mettre à jour la date de modification automatiquement
wishlistSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

const WishlistModel = model("Wishlist", wishlistSchema);

module.exports = WishlistModel;
