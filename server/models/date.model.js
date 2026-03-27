const { Schema, model } = require("mongoose");

const dateSchema = Schema({
  date: { type: Date, required: true },
  name: String,
  surname: String,
  nameday: {
    type: String,
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
    timings: { type: [Number], default: [1] },
    notifyOnBirthday: { type: Boolean, default: true },
  },

  namedayPreferences: {
    timings: {
      type: [Number],
      default: [1],
      validate: {
        validator: function (arr) {
          return arr.every((n) => [1, 7].includes(n));
        },
        message:
          "Les timings de fête doivent être 1 (veille) ou 7 (semaine avant)",
      },
    },
    notifyOnNameday: { type: Boolean, default: true },
  },

  comment: { type: Array, default: [] },

  gifts: [
    {
      giftName: { type: String, required: true },
      purchased: { type: Boolean, default: false },

      // String libre — plus d'enum restrictif
      // Valeurs courantes : "Anniversaire", "Noël", "Saint-Valentin", etc.
      // Anciennes valeurs en base ("birthday", "christmas", "other") restent valides
      occasion: {
        type: String,
        default: "Anniversaire",
      },
      year: {
        type: Number,
        default: () => new Date().getFullYear(),
      },
      purchasedAt: {
        type: Date,
        default: null,
      },

      // Nouveaux champs — infos produit
      url: { type: String, default: null },
      price: { type: Number, default: null },
      image: { type: String, default: null },
    },
  ],

  linkedUser: {
    type: Schema.Types.ObjectId,
    ref: "User",
    default: null,
  },
});

const dateModel = model("Date", dateSchema);

module.exports = dateModel;
