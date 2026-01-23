const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const User = require("./user.model");

const friendSchema = new Schema(
  {
    // L'utilisateur qui a envoyé/reçu la demande
    user: {
      type: Schema.Types.ObjectId,
      ref: "user",
      required: true,
    },

    // L'ami (l'autre utilisateur)
    friend: {
      type: Schema.Types.ObjectId,
      ref: "user",
      required: true,
    },

    // Statut de l'amitié
    status: {
      type: String,
      enum: ["pending", "accepted", "rejected", "blocked"],
      default: "pending",
    },

    // Qui a initié la demande
    requestedBy: {
      type: Schema.Types.ObjectId,
      ref: "user",
      required: true,
    },

    // Date de la demande
    requestedAt: {
      type: Date,
      default: Date.now,
    },

    // Date d'acceptation
    acceptedAt: {
      type: Date,
    },

    // Si cet ami est lié à une date existante
    linkedDate: {
      type: Schema.Types.ObjectId,
      ref: "Date",
    },
  },
  {
    timestamps: true,
  },
);

// Index pour éviter les doublons et accélérer les recherches
friendSchema.index({ user: 1, friend: 1 }, { unique: true });
friendSchema.index({ status: 1 });

// Méthode pour vérifier si deux users sont amis
friendSchema.statics.areFriends = async function (userId1, userId2) {
  const friendship = await this.findOne({
    $or: [
      { user: userId1, friend: userId2, status: "accepted" },
      { user: userId2, friend: userId1, status: "accepted" },
    ],
  });
  return !!friendship;
};

// Méthode pour obtenir tous les amis d'un user
friendSchema.statics.getFriends = async function (userId) {
  const friendships = await this.find({
    $or: [
      { user: userId, status: "accepted" },
      { friend: userId, status: "accepted" },
    ],
  })
    .populate("user", "name surname email avatar birthDate") // ✅ CORRIGÉ
    .populate("friend", "name surname email avatar birthDate") // ✅ CORRIGÉ
    .populate("linkedDate");

  // Retourner l'ami (pas soi-même)
  return friendships.map((f) => ({
    friendship: f,
    friendUser: f.user._id.toString() === userId ? f.friend : f.user,
    linkedDate: f.linkedDate,
  }));
};

// Méthode pour obtenir les demandes en attente
friendSchema.statics.getPendingRequests = async function (userId) {
  return await this.find({
    friend: userId,
    status: "pending",
  })
    .populate("user", "name surname email avatar birthDate") // ✅ CORRIGÉ
    .populate("requestedBy", "name surname email avatar birthDate"); // ✅ CORRIGÉ
};

const Friend = mongoose.model("Friend", friendSchema);

module.exports = Friend;
