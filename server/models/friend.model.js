const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const friendSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    friend: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "accepted", "rejected", "blocked"],
      default: "pending",
    },
    requestedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: false, // ✅ optionnel pour les invitations automatiques
    },
    requestedAt: {
      type: Date,
      default: Date.now,
    },
    acceptedAt: {
      type: Date,
    },
    linkedDate: {
      type: Schema.Types.ObjectId,
      ref: "Date",
    },
  },
  { timestamps: true },
);

friendSchema.index({ user: 1, friend: 1 }, { unique: true });
friendSchema.index({ status: 1 });

friendSchema.statics.areFriends = async function (userId1, userId2) {
  const friendship = await this.findOne({
    $or: [
      { user: userId1, friend: userId2, status: "accepted" },
      { user: userId2, friend: userId1, status: "accepted" },
    ],
  });
  return !!friendship;
};

friendSchema.statics.getFriends = async function (userId) {
  const friendships = await this.find({
    $or: [
      { user: userId, status: "accepted" },
      { friend: userId, status: "accepted" },
    ],
  })
    .populate("user", "name surname email avatar birthDate")
    .populate("friend", "name surname email avatar birthDate")
    .populate("linkedDate");

  return friendships.map((f) => ({
    friendship: f,
    friendUser: f.user._id.toString() === userId ? f.friend : f.user,
    linkedDate: f.linkedDate,
  }));
};

friendSchema.statics.getPendingRequests = async function (userId) {
  return await this.find({ friend: userId, status: "pending" })
    .populate("user", "name surname email avatar birthDate")
    .populate("requestedBy", "name surname email avatar birthDate");
};

const Friend = mongoose.model("Friend", friendSchema);
module.exports = Friend;
