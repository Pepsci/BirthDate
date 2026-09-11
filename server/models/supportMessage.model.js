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
supportMessageSchema.index({ userId: 1, lastMessageAt: -1 });

module.exports = model("SupportMessage", supportMessageSchema);
