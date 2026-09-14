const mongoose = require("mongoose");
const { Schema, model } = mongoose;

/**
 * Ticket de support : un fil de discussion entre un utilisateur (connecté ou
 * visiteur anonyme via le formulaire public) et l'équipe.
 *
 * Un utilisateur connecté peut continuer la conversation directement dans
 * l'app (chat) : chaque réponse admin déclenche une notification in-app.
 * Un visiteur sans compte n'a pas d'espace où revenir — la réponse admin lui
 * est alors envoyée par email (seul canal disponible), et le ticket passe
 * directement à "closed".
 */
const messageSchema = new Schema(
  {
    sender: { type: String, enum: ["user", "admin"], required: true },
    body: { type: String, required: true, maxlength: 5000 },
    // Qui a écrit le message côté admin (pour audit / affichage "répondu par").
    adminId: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

const supportMessageSchema = new Schema(
  {
    // Absent pour un ticket ouvert via le formulaire public sans compte.
    userId: { type: Schema.Types.ObjectId, ref: "User", required: false },
    name: { type: String, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    subject: { type: String, required: true, trim: true, maxlength: 150 },

    /**
     * Nature du ticket.
     *
     * ⚠️ "pool" échappe à la règle du ticket unique — et c'est délibéré.
     *
     * La règle « une seule conversation à la fois » sert à éviter des fils
     * parallèles sur le même sujet. Appliquée aux litiges de cagnotte, elle
     * produit l'inverse de ce qu'on veut : quelqu'un qui a une question en
     * cours sur autre chose se retrouve incapable de signaler qu'il n'a pas
     * été remboursé. C'est le seul cas où de l'argent est en jeu, et c'est
     * précisément celui qu'on bloquait.
     *
     * Le garde-fou devient alors : un ticket ouvert par cagnotte concernée
     * (voir `relatedEvent`), ce qui borne naturellement leur nombre à celui
     * des cagnottes auxquelles la personne a réellement participé.
     */
    category: {
      type: String,
      enum: ["general", "pool"],
      default: "general",
    },

    /**
     * Cagnotte concernée, pour un ticket de catégorie "pool".
     *
     * Côté admin, c'est ce qui permet d'ouvrir directement la cagnotte en
     * question au lieu de la chercher à partir d'un message en texte libre.
     * Côté serveur, c'est la clé du plafond : un ticket ouvert par événement.
     */
    relatedEvent: {
      type: Schema.Types.ObjectId,
      ref: "Event",
      default: null,
    },
    status: {
      type: String,
      enum: ["open", "answered", "closed"],
      default: "open",
    },
    messages: { type: [messageSchema], default: [] },
    lastMessageAt: { type: Date, default: Date.now },
    // Indicateurs de "non lu" pour les badges de nav (admin ET utilisateur).
    unreadAdmin: { type: Boolean, default: true },
    unreadUser: { type: Boolean, default: false },
  },
  { timestamps: true },
);

supportMessageSchema.index({ status: 1, lastMessageAt: -1 });
// Recherche du ticket ouvert pour une cagnotte donnée (plafond + admin).
supportMessageSchema.index({ userId: 1, relatedEvent: 1, status: 1 });
supportMessageSchema.index({ userId: 1, lastMessageAt: -1 });

module.exports = model("SupportMessage", supportMessageSchema);
