const { Schema, model } = require("mongoose");

const organizerBankInfoSchema = new Schema(
  {
    event: {
      type: Schema.Types.ObjectId,
      ref: "Event",
      required: true,
      unique: true, // un seul RIB par événement
    },
    organizer: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    // IBAN chiffré (AES-256-GCM) — jamais stocké en clair
    ibanEncrypted: { type: String, required: true },
    iv: { type: String, required: true },
    authTag: { type: String, required: true },
    // Titulaire du compte (en clair, c'est un nom, pas une donnée critique seule)
    holderName: { type: String, trim: true },
    // Date d'expiration → purge automatique par l'index TTL
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);

// Index TTL : MongoDB supprime le document dès que expiresAt est dépassé.
// expireAfterSeconds: 0 → la suppression se déclenche à la date exacte d'expiresAt.
organizerBankInfoSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = model("OrganizerBankInfo", organizerBankInfoSchema);
