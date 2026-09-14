const mongoose = require("mongoose");
const { REACTIONS } = require("../constants/reactions");
const { Schema } = mongoose;

const eventMessageSchema = new Schema(
  {
    event: {
      type: Schema.Types.ObjectId,
      ref: "Event",
      required: true,
    },
    sender: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    content: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50000,
    },
    isEncrypted: {
      type: Boolean,
      default: false,
    },
    encryptedFor: {
      type: Map,
      of: String,
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
    readBy: [
      {
        user: {
          type: Schema.Types.ObjectId,
          ref: "User",
        },
        readAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  { timestamps: true },
);

eventMessageSchema.index({ event: 1, createdAt: -1 });

module.exports = mongoose.model("EventMessage", eventMessageSchema);
