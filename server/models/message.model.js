const mongoose = require("mongoose");
const { REACTIONS } = require("../constants/reactions");

const messageSchema = new mongoose.Schema(
  {
    conversation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    // "text" (défaut) | "gift_share" | "date_share"
    // date_share : partage d'une carte anniversaire (nom, date, fête) que le
    // destinataire peut ajouter à ses propres dates. Les idées cadeaux ne sont
    // JAMAIS incluses — c'est ce qui le distingue de gift_share.
    type: {
      type: String,
      enum: ["text", "gift_share", "date_share"],
      default: "text",
    },
    content: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50000,
    },
    // Payload structuré pour les messages non-texte (gift_share, etc.)
    // Pas chiffré intentionnellement — ce sont des métadonnées de coordination
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    isEncrypted: {
      type: Boolean,
      default: false,
    },
    /**
     * Empreinte de l'expéditeur, écrite au moment où son compte est purgé.
     *
     * Le destinataire garde sa copie des messages (voir `clears` sur
     * Conversation), mais le déchiffrement NaCl exige la clé publique de
     * l'émetteur. Sans cette recopie, la suppression d'un compte rendrait
     * illisibles des messages qu'on s'était engagé à conserver — y compris
     * ceux qui servent de preuve après un signalement.
     *
     * Ne contient rien de personnel : un libellé générique et une clé publique.
     */
    senderSnapshot: {
      type: {
        _id: false,
        name: String,
        publicKey: String,
      },
      default: null,
    },
    encryptedFor: {
      type: Map,
      of: String,
      default: null,
    },
    readBy: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        readAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    // UUID généré par l'appareil : rend l'envoi idempotent (réponse depuis une
    // notification, rejouée si iOS a coupé la requête). Voir sendDirectMessage.js
    clientId: {
      type: String,
      default: undefined,
    },
    // Accusé « distribué » : le message a atteint un appareil du destinataire
    // (socket ouvert à l'envoi, ou reconnexion ensuite). Voir utils/messageReceipts.js
    deliveredTo: [
      {
        _id: false,
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        deliveredAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    // Réponse à un autre message — la citation est résolue côté client
    // (compatible E2E : le serveur ne connaît jamais le texte cité)
    replyTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
      default: null,
    },
    /**
     * Réactions posées sur ce message.
     *
     * ⚠️ La clé est sémantique ("love"), pas un emoji : le rendu peut changer
     * sans migration, et l'on peut compter proprement.
     *
     * ⚠️ Les réactions ne sont PAS chiffrées, contrairement au contenu.
     * Compromis assumé : le serveur sait donc qu'un utilisateur a posé un cœur
     * sur un message donné. Pris isolément, l'emoji ne révèle presque rien —
     * il n'a de sens que rapporté à un texte que nous ne pouvons pas lire. Les
     * chiffrer imposerait de re-chiffrer pour chaque destinataire à chaque
     * réaction, pour un gain de confidentialité marginal.
     *
     * Une réaction par utilisateur et par message : poser une seconde réaction
     * remplace la première, comme sur WhatsApp. C'est ce que garantit l'index
     * unique plus bas.
     */
    reactions: [
      {
        _id: false,
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        reaction: {
          type: String,
          enum: REACTIONS,
          required: true,
        },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    edited: {
      type: Boolean,
      default: false,
    },
    editedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  },
);

messageSchema.index({ conversation: 1, createdAt: -1 });
// Anti-doublon des envois rejoués : partiel, les messages sans clientId
// (tous les anciens) n'y entrent pas.
messageSchema.index(
  { conversation: 1, sender: 1, clientId: 1 },
  { unique: true, partialFilterExpression: { clientId: { $type: "string" } } },
);

module.exports = mongoose.model("Message", messageSchema);