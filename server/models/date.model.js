const { Schema, model } = require("mongoose");

// Dans models/date.model.js
const dateSchema = Schema({
  date: { type: Date, required: true },
  name: String,
  surname: String,
  nameday: {
    type: String, // Format "MM-DD"
    required: false,
    validate: {
      validator: function (v) {
        if (!v) return true;
        return /^\d{2}-\d{2}$/.test(v);
      },
      message: "Nameday must be in MM-DD format",
    },
  },
  owner: { type: Schema.Types.ObjectId, ref: "User" },
  family: { type: Boolean, default: false },

  receiveNotifications: {
    type: Boolean,
    default: true,
  },

  notificationPreferences: {
    timings: {
      type: [Number],
      default: [1],
    },
    notifyOnBirthday: {
      type: Boolean,
      default: true,
    },
  },

  comment: {
    type: Array,
    default: [],
  },

  gifts: [
    {
      giftName: { type: String, required: true },
      purchased: { type: Boolean, default: false },

      occasion: {
        type: String,
        enum: ["birthday", "christmas", "other"],
        default: "birthday",
      },
      year: {
        type: Number,
        default: () => new Date().getFullYear(),
      },
      purchasedAt: {
        type: Date,
        default: null,
      },
    },
  ],

  // Pour lier à un utilisateur inscrit (plus tard)
  linkedUser: {
    type: Schema.Types.ObjectId,
    ref: "User",
    default: null,
  },
});

const dateModel = model("Date", dateSchema);

module.exports = dateModel;
