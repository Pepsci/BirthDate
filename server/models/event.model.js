const mongoose = require("mongoose");
const { Schema } = mongoose;

const eventSchema = new Schema(
  {
    shortId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
    },
    description: String,
    type: {
      type: String,
      enum: ["birthday", "party", "dinner", "other"],
      required: true,
    },
    organizer: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    forPerson: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    forDate: {
      type: Schema.Types.ObjectId,
      ref: "Date",
      default: null,
    },
    recurrence: {
      enabled: { type: Boolean, default: false },
      frequency: { type: String, enum: ["yearly", "custom"] },
      nextOccurrence: Date,
    },

    // Dates
    dateMode: {
      type: String,
      enum: ["fixed", "vote"],
      required: true,
    },
    fixedDate: Date,
    dateOptions: [Date],
    selectedDate: Date,

    // Lieux
    locationMode: {
      type: String,
      enum: ["fixed", "vote"],
      required: true,
    },
    fixedLocation: {
      name: String,
      address: String,
      coordinates: {
        lat: Number,
        lng: Number,
      },
    },
    locationOptions: [
      {
        name: String,
        address: String,
        coordinates: { lat: Number, lng: Number },
      },
    ],
    selectedLocation: {
      name: String,
      address: String,
      coordinates: { lat: Number, lng: Number },
    },

    // Cadeaux
    giftMode: {
      type: String,
      enum: ["imposed", "proposals"],
      required: true,
    },
    imposedGifts: [
      {
        name: String,
        url: String,
        price: Number,
      },
    ],
    maxGiftProposalsPerUser: {
      type: Number,
      default: null, // null = illimité
    },
    // [CAGNOTTE — placeholder, à intégrer ultérieurement]
    giftPoolEnabled: {
      type: Boolean,
      default: false,
    },
    // giftPool: { type: ObjectId, ref: 'GiftPool' }

    // Invitations
    maxGuests: {
      type: Number,
      default: null, // null = illimité
    },
    accessCode: {
      type: String, // code 6 chars pour rejoindre sans compte
      required: true,
      unique: true,
    },
    allowExternalGuests: {
      type: Boolean,
      default: true,
    },
    allowGuestInvites: {
      type: Boolean,
      default: false,
    },

    // Rappels
    reminders: [
      {
        type: {
          type: String,
          enum: ["event_date", "pool_deadline"],
        },
        daysBeforeEvent: Number,
        sent: { type: Boolean, default: false },
      },
    ],

    status: {
      type: String,
      enum: ["draft", "published", "cancelled", "done"],
      default: "draft",
    },

    organizerNotificationPrefs: {
      rsvp: { type: Boolean, default: true },
      dateVote: { type: Boolean, default: true },
      locationVote: { type: Boolean, default: true },
      giftProposed: { type: Boolean, default: true },
      giftVote: { type: Boolean, default: true },
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// Virtual pour les invitations (évite le populate manuel)
eventSchema.virtual("invitations", {
  ref: "EventInvitation",
  localField: "_id",
  foreignField: "event",
});

// Indexes pour performance
eventSchema.index({ organizer: 1 });
eventSchema.index({ status: 1 });

module.exports = mongoose.model("Event", eventSchema);
