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
    // Visiteur du lien public : pas de compte, on ne garde que le prénom qu'il
    // a saisi. C'est ce qui lui permet ensuite de libérer SA réservation.
    reservedByGuest: { type: String, default: null },
    reservedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

const sharedGiftListSchema = new Schema(
  {
    // `members` : le créateur et les contributeurs. Droits complets — ajouter,
    // modifier, supprimer une idée, inviter et révoquer des invités.
    members: [{ type: Schema.Types.ObjectId, ref: "User" }],
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },

    // `viewers` : contacts à qui la liste a été partagée depuis l'app. Ils
    // peuvent CONSULTER et RÉSERVER, rien d'autre — ils ne touchent jamais au
    // contenu de la liste et ne voient pas les prénoms des réserveurs.
    // On garde qui a invité et quand, pour l'écran de gestion des accès.
    viewers: [
      {
        user: { type: Schema.Types.ObjectId, ref: "User", required: true },
        addedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
        addedAt: { type: Date, default: Date.now },
      },
    ],

    // Code demandé aux visiteurs du lien public AU MOMENT DE RÉSERVER — jamais
    // pour consulter. Même principe que le code ami des wishlists : le lien
    // circule librement, mais bloquer un cadeau demande de connaître le code.
    accessCode: { type: String, default: null },
    // Libellé indicatif (ex : "Idées pour Tom")
    label: { type: String, default: null },
    gifts: [sharedGiftSchema],

    // ── Partage public ────────────────────────────────────────────────────
    // Même principe que la wishlist publique d'un utilisateur : un lien opaque
    // qu'on donne à qui on veut, sans compte requis pour le consulter.
    // Le slug est conservé quand on repasse la liste en privé, pour qu'un
    // lien déjà distribué redevienne valide si on réactive le partage.
    isPublic: { type: Boolean, default: false },
    publicSlug: {
      type: String,
      default: null,
      index: {
        unique: true,
        // partialFilterExpression : sans ça, toutes les listes non partagées
        // partageraient la valeur null et violeraient l'unicité.
        partialFilterExpression: { publicSlug: { $type: "string" } },
      },
    },
  },
  { timestamps: true },
);

sharedGiftListSchema.index({ members: 1 });

module.exports = mongoose.model("SharedGiftList", sharedGiftListSchema);
