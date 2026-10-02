const { Schema, model } = require("mongoose");

/**
 * Bandeaux de l'accueil mobile, édités depuis l'admin (onglet « Bandeaux app »).
 * Un seul document (key: "mobile").
 *
 *  - android / ios : dernière version DISPONIBLE en store. L'app compare avec
 *    sa propre version (CHANGELOG[0].version) et affiche « Nouvelle version
 *    disponible » si elle est en retard. À renseigner seulement une fois le
 *    build téléchargeable. title / message facultatifs (texte par défaut sinon).
 *  - announcement : annonce libre. `id` change à chaque nouvelle publication :
 *    une annonce fermée ne revient jamais (l'app mémorise l'id), une nouvelle
 *    annonce s'affiche à tout le monde.
 */
const releaseSchema = new Schema(
  {
    version: { type: String, default: null, match: /^\d+(\.\d+){0,3}$/ },
    url: { type: String, default: null },
    title: { type: String, default: null, maxlength: 80 },
    message: { type: String, default: null, maxlength: 240 },
  },
  { _id: false },
);

const announcementSchema = new Schema(
  {
    id: { type: String, required: true },
    title: { type: String, default: null, maxlength: 80 },
    message: { type: String, default: null, maxlength: 400 },
    url: { type: String, default: null },
    platforms: {
      type: [{ type: String, enum: ["android", "ios"] }],
      default: ["android", "ios"],
    },
    // Date de fin incluse, "AAAA-MM-JJ", ou null
    until: { type: String, default: null, match: /^\d{4}-\d{2}-\d{2}$/ },
  },
  { _id: false },
);

const appBannerSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, default: "mobile" },
    android: {
      type: releaseSchema,
      default: () => ({
        version: null,
        url: "https://play.google.com/store/apps/details?id=com.birthreminder.app",
      }),
    },
    ios: {
      type: releaseSchema,
      default: () => ({ version: null, url: "itms-beta://" }),
    },
    announcement: { type: announcementSchema, default: null },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true },
);

/** Le document unique, créé avec les valeurs par défaut s'il n'existe pas. */
appBannerSchema.statics.getMobile = async function getMobile() {
  return this.findOneAndUpdate(
    { key: "mobile" },
    { $setOnInsert: { key: "mobile" } },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );
};

module.exports = model("AppBanner", appBannerSchema);
