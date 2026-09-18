const { Schema, model } = require("mongoose");

/**
 * Restriction d'accès aux cagnottes pour un utilisateur.
 *
 * Modèle séparé plutôt qu'un champ sur User (schéma User figé, voir CLAUDE.md),
 * et parce qu'on veut garder l'historique : qui a bloqué, pourquoi, quand
 * c'est levé.
 *
 *  - "birthdate_cooldown" : la date de naissance vient de passer de mineur (ou
 *    absente) à majeur. Délai de 30 jours avant de pouvoir collecter, pour
 *    qu'un mineur ne débloque pas la cagnotte en changeant sa date en deux
 *    clics. `until` = fin du délai.
 *  - "admin_block" : un admin a constaté (ou appris) que l'utilisateur est
 *    mineur ou a menti. Sans échéance (`until: null`) jusqu'à levée manuelle.
 *
 * Une restriction est active si `liftedAt` est null ET (`until` null ou futur).
 */
const poolRestrictionSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    kind: {
      type: String,
      enum: ["birthdate_cooldown", "admin_block"],
      required: true,
    },
    until: { type: Date, default: null },
    reason: { type: String, default: "" },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    liftedAt: { type: Date, default: null },
    liftedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true },
);

module.exports = model("PoolRestriction", poolRestrictionSchema);
