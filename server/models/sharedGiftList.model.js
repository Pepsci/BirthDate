const mongoose = require("mongoose");
const { Schema } = mongoose;

/**
 * Liste d'idées cadeaux commune, partagée entre plusieurs membres.
 * Chaque membre relie sa propre carte (Date) à cette liste via Date.sharedGiftList.
 */
const sharedGiftSchema = new Schema(
  {
    giftName: { type: String, required: true },
    occasion: { type: String, default: "Anniversaire" },
    year: { type: Number, default: () => new Date().getFullYear() },
    purchased: { type: Boolean, default: false },
    status: {
      type: String,
      enum: ["to_buy", "bought", "to_give", "offered"],
      default: "to_buy",
    },
    url: { type: String, default: null },
    price: { type: Number, default: null },
    image: { type: String, default: null },
    addedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    // Réservation : « je m'en occupe », avant tout achat. Distinct de `status`,
    // qui décrit l'avancement du cadeau ; ici on retient QUI s'en charge.
    // Les membres d'une liste commune sont les offrants — la personne
    // concernée n'y a pas accès — donc afficher le nom ne gâche aucune
    // surprise, et c'est ce qui évite le double achat.
    reservedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    reservedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

const sharedGiftListSchema = new Schema(
  {
    members: [{ type: Schema.Types.ObjectId, ref: "User" }],
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
    // Libellé indicatif (ex : "Idées pour Tom")
    label: { type: String, default: null },
    gifts: [sharedGiftSchema],
  },
  { timestamps: true },
);

sharedGiftListSchema.index({ members: 1 });

module.exports = mongoose.model("SharedGiftList", sharedGiftListSchema);
