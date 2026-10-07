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
    /**
     * Idée réservée aux MEMBRES : invisible aux invités internes comme aux
     * visiteurs du lien public. Même intention que `isShared` sur un article
     * de wishlist : sauf qu'ici on cache à ceux à qui la liste est partagée,
     * pas à la personne concernée.
     *
     * Sert à ce qu'on garde entre gestionnaires : le gros cadeau qu'on se
     * réserve, l'idée encore incertaine, celle dont le prix ne regarde pas
     * tout le monde. Filtré côté SERVEUR, jamais côté client : une idée
     * cachée ne doit pas partir sur le réseau vers quelqu'un qui n'y a pas
     * droit, même si elle reste invisible à l'écran.
     */
    hiddenFromViewers: { type: Boolean, default: false },
    // Réservation : « je m'en occupe », avant tout achat. Distinct de `status`,
    // qui décrit l'avancement du cadeau ; ici on retient QUI s'en charge.
    // Les membres d'une liste commune sont les offrants : la personne
    // concernée n'y a pas accès : donc afficher le nom ne gâche aucune
    // surprise, et c'est ce qui évite le double achat.
    reservedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    // Visiteur du lien public : pas de compte. Le prénom est ce que les
    // membres verront : c'est la seule part de son identité qui sort d'ici.
    reservedByGuest: { type: String, default: null },
    // ⚠️ Le prénom NE PEUT PAS servir de preuve d'identité. Il l'a fait, et
    // ça donnait deux défauts : le serveur ne savait pas reconnaître le
    // navigateur du réserveur (tout le monde voyait « libérer ma
    // réservation »), et connaître un prénom suffisait à défaire la
    // réservation de quelqu'un d'autre. Le jeton, lui, est tiré au hasard et
    // ne quitte jamais le navigateur du visiteur : sauf par le mail de
    // confirmation, qui est justement ce qui lui permet de retrouver sa
    // réservation depuis un autre appareil.
    reservedByGuestToken: { type: String, default: null },
    // Facultatif : uniquement pour l'accusé de réception et le lien de
    // gestion. Jamais renvoyée par l'API : ni aux membres, ni sur la page
    // publique : et jamais réutilisée pour autre chose.
    reservedByGuestEmail: { type: String, default: null },
    reservedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

/**
 * Proposition d'idée faite par un INVITÉ (viewer).
 *
 * Un invité ne touche jamais au contenu de la liste. Il peut en revanche
 * suggérer une idée : elle attend ici, hors de `gifts`, qu'un gestionnaire
 * l'accepte (une idée normale est alors créée dans `gifts`) ou la refuse.
 *
 * Une proposition traitée N'EST PAS supprimée : elle garde son résultat
 * (`status`, `decidedAt`, `decidedBy`). C'est ce qui permet à son auteur de
 * retrouver la réponse dans la liste, même s'il a effacé la notification
 * sans la lire. L'historique est plafonné côté route (les plus anciennes
 * propositions traitées sont retirées).
 *
 * Mêmes champs qu'une idée (`giftName`, `occasion`, `year`, `url`, `price`,
 * `image`) : une proposition acceptée devient une idée sans rien perdre.
 *
 * Visible des gestionnaires, et de son auteur uniquement. Les autres invités
 * et le lien public n'en voient rien : filtré côté serveur, comme
 * `hiddenFromViewers`.
 */
const sharedGiftProposalSchema = new Schema(
  {
    giftName: { type: String, required: true },
    occasion: { type: String, default: "Anniversaire" },
    year: { type: Number, default: () => new Date().getFullYear() },
    url: { type: String, default: null },
    price: { type: Number, default: null },
    image: { type: String, default: null },
    proposedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    status: {
      type: String,
      enum: ["pending", "accepted", "declined"],
      default: "pending",
    },
    decidedAt: { type: Date, default: null },
    decidedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    // L'auteur a effacé cette réponse de SA liste. La proposition n'est pas
    // supprimée pour autant : les gestionnaires gardent leur historique.
    hiddenByProposer: { type: Boolean, default: false },
    // Idée créée dans `gifts` quand la proposition a été acceptée. Sert à la
    // retirer si un gestionnaire revient sur sa décision.
    giftId: { type: Schema.Types.ObjectId, default: null },
  },
  { timestamps: true },
);

const sharedGiftListSchema = new Schema(
  {
    // `members` : le créateur et les contributeurs. Droits complets : ajouter,
    // modifier, supprimer une idée, inviter et révoquer des invités.
    members: [{ type: Schema.Types.ObjectId, ref: "User" }],
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },

    // `viewers` : contacts à qui la liste a été partagée depuis l'app. Ils
    // peuvent CONSULTER et RÉSERVER, rien d'autre : ils ne touchent jamais au
    // contenu de la liste et ne voient pas les prénoms des réserveurs.
    // On garde qui a invité et quand, pour l'écran de gestion des accès.
    viewers: [
      {
        user: { type: Schema.Types.ObjectId, ref: "User", required: true },
        addedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
        addedAt: { type: Date, default: Date.now },
      },
    ],

    // Code demandé aux visiteurs du lien public POUR OUVRIR LA LISTE. Tant
    // qu'il n'est pas donné, l'API ne renvoie même pas les idées : le lien
    // seul ne montre rien. Une liste sans code reste consultable et
    // réservable avec le lien seul.
    accessCode: { type: String, default: null },
    // Libellé indicatif (ex : "Idées pour Tom")
    label: { type: String, default: null },
    gifts: [sharedGiftSchema],
    // Idées suggérées par des invités, en attente de décision d'un
    // gestionnaire. Voir sharedGiftProposalSchema.
    proposals: [sharedGiftProposalSchema],

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
