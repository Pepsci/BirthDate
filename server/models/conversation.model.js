const mongoose = require("mongoose");

const conversationSchema = new mongoose.Schema(
  {
    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
    ],
    lastMessage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
    },
    lastMessageAt: {
      type: Date,
      default: Date.now,
    },
    /**
     * Effacement PAR PARTICIPANT (« supprimer pour moi »).
     *
     * Supprimer une conversation ne détruit plus les messages : on enregistre
     * la date à laquelle chacun a fait le ménage de son côté, et on ne lui
     * montre plus rien d'antérieur. L'autre garde son historique intact.
     *
     * Deux raisons de ne pas détruire des deux côtés : les messages reçus sont
     * aussi les données personnelles du destinataire, et surtout un harceleur
     * ne doit pas pouvoir effacer la preuve de son harcèlement après avoir été
     * signalé — ce qui viderait le dispositif de modération de sa substance.
     *
     * Un nouveau message rend naturellement le fil visible : sa date est
     * postérieure au `at`, aucun nettoyage du tableau n'est nécessaire.
     */
    clears: [
      {
        _id: false,
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        at: { type: Date, required: true },
      },
    ],
  },
  {
    timestamps: true,
  },
);

// Index pour optimiser les recherches
conversationSchema.index({ participants: 1, lastMessageAt: -1 });

// Méthode pour trouver ou créer une conversation entre deux utilisateurs
conversationSchema.statics.findOrCreate = async function (user1Id, user2Id) {
  let conversation = await this.findOne({
    participants: { $all: [user1Id, user2Id], $size: 2 },
  });

  if (!conversation) {
    conversation = await this.create({
      participants: [user1Id, user2Id],
    });
  }

  return conversation;
};

/**
 * Date du dernier « supprimer pour moi » de cet utilisateur, ou null.
 * Tout message antérieur doit lui rester invisible.
 */
conversationSchema.methods.clearedAtFor = function (userId) {
  const uid = String(userId);
  const entry = (this.clears || []).find((c) => String(c.user) === uid);
  return entry ? entry.at : null;
};

// Méthode helper pour compter les messages non lus
conversationSchema.methods.getUnreadCount = async function (userId) {
  const Message = mongoose.model("Message");

  const clearedAt = this.clearedAtFor(userId);

  const unreadMessages = await Message.countDocuments({
    conversation: this._id,
    sender: { $ne: userId },
    "readBy.user": { $ne: userId },
    ...(clearedAt ? { createdAt: { $gt: clearedAt } } : {}),
  });

  return unreadMessages;
};

module.exports = mongoose.model("Conversation", conversationSchema);
