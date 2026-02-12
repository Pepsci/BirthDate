const mongoose = require("mongoose");
const { Schema, model } = mongoose;

const logSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    action: {
      type: String,
      required: true,
      enum: [
        "login",
        "logout",
        "signup",
        "password_reset",
        "account_update",
        "account_delete",
        "friend_add",
        "message_send",
      ],
    },
    ipAddress: {
      type: String,
      required: true,
    },
    userAgent: String,
    metadata: Schema.Types.Mixed, // Données supplémentaires si besoin
  },
  {
    timestamps: true, // Ajoute createdAt et updatedAt
  },
);

// Index pour supprimer automatiquement les logs > 1 an
logSchema.index({ createdAt: 1 }, { expireAfterSeconds: 31536000 }); // 365 jours

module.exports = model("Log", logSchema);
