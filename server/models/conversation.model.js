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

// Méthode helper pour compter les messages non lus
conversationSchema.methods.getUnreadCount = async function (userId) {
  const Message = mongoose.model("Message");

  const unreadMessages = await Message.countDocuments({
    conversation: this._id,
    sender: { $ne: userId },
    "readBy.user": { $ne: userId },
  });

  return unreadMessages;
};

module.exports = mongoose.model("Conversation", conversationSchema);
