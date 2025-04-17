const { Schema, model } = require("mongoose");

// Dans models/date.model.js
const dateSchema = Schema({
  date: { type: Date, required: true },
  name: String,
  surname: String,
  owner: { type: Schema.Types.ObjectId, ref: "user" },
  family: { type: Boolean, default: false },
  // Nouveau champ pour les notifications
  receiveNotifications: {
    type: Boolean,
    default: true, // Par défaut, on envoie des notifications
  },
  // Option pour les préférences de timing des notifications
  notificationPreferences: {
    timings: {
      type: [Number],
      default: [1], // Par défaut, notification 1 jour avant
    },
    notifyOnBirthday: {
      type: Boolean,
      default: false,
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
    },
  ],
});

const dateModel = model("Date", dateSchema);

module.exports = dateModel;
