const mongoose = require("mongoose");

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
    // "text" (défaut) | "gift_share"
    type: {
      type: String,
      enum: ["text", "gift_share"],
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

module.exports = mongoose.model("Message", messageSchema);