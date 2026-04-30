const mongoose = require("mongoose");
const { Schema } = mongoose;

const eventGiftProposalSchema = new Schema(
  {
    event: {
      type: Schema.Types.ObjectId,
      ref: "Event",
      required: true,
    },
    proposedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    guestName: {
      type: String,
      default: null,
    },
    guestVotes: {
      type: [String],
      default: [],
    },
    name: {
      type: String,
      required: true,
    },
    url: String,
    price: Number,
    votes: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
    ],
  },
  { timestamps: true },
);

// Indexes
eventGiftProposalSchema.index({ event: 1 });

module.exports = mongoose.model("EventGiftProposal", eventGiftProposalSchema);
