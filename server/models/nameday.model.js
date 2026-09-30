const { Schema, model } = require("mongoose");

/**
 * Calendrier des fêtes — une ligne par prénom.
 *
 * Deux sortes de lignes :
 *  - prénom principal (aliasOf: null)     : « Michel » → 09-29
 *  - variante         (aliasOf: "Michel") : « Mickaël » → même date que Michel
 *
 * La date d'une variante est recopiée depuis son prénom principal (et remise à
 * jour quand il change) : la recherche reste une simple lecture clé → date.
 *
 * Source de vérité en production. Rempli au premier démarrage depuis
 * data/namedays/fr.json, modifiable ensuite depuis l'admin (onglet Fêtes).
 * Voir utils/namedayHelper.js pour le chargement et le cache mémoire.
 */
const namedaySchema = new Schema(
  {
    country: { type: String, default: "fr", lowercase: true },
    // Prénom tel qu'affiché : « Raphaël »
    name: { type: String, required: true, trim: true },
    // Clé de recherche normalisée (stripName) : « raphael »
    key: { type: String, required: true },
    date: {
      type: String,
      required: true,
      match: /^\d{2}-\d{2}$/,
    },
    // Prénom principal dont c'est une variante, ou null
    aliasOf: { type: String, default: null },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true },
);

// Un prénom n'a qu'une fête par pays
namedaySchema.index({ country: 1, key: 1 }, { unique: true });
namedaySchema.index({ country: 1, aliasOf: 1 });

module.exports = model("Nameday", namedaySchema);
