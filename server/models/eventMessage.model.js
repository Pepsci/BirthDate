const mongoose = require("mongoose");
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
