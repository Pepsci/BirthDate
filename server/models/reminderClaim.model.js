const mongoose = require("mongoose");
const { Schema, model } = mongoose;

/**
 * Verrou d'idempotence pour les rappels planifiés (anniversaires, fêtes).
 *
 * Le cron de minuit (jobs/sendReminders.js) ne doit envoyer chaque rappel
 * qu'UNE fois par jour, quel que soit le nombre de fois où le job se
 * déclenche réellement ce jour-là — plusieurs instances pm2, un restart au
 * mauvais moment, ou (historiquement) un poste de dev qui tournait en même
 * temps que la prod ont déjà produit des doublons (email, push ET
 * notification in-app en double). Plutôt que de traquer chaque cause une
 * par une, chaque rappel commence par « réclamer » ce document : le premier
 * appel réussit (crée le document), tous les suivants pour la même
 * combinaison le même jour échouent sur l'index unique et sont ignorés —
 * voir claimReminder() dans sendReminders.js.
 *
 * Purge : un TTL sur `sentDate`+30j suffit, ces documents n'ont pas besoin
 * de survivre indéfiniment (voir l'index expires ci-dessous).
 */
const reminderClaimSchema = new Schema(
  {
    // ID de la carte (date.model) ou de l'utilisateur (anniversaire perso).
    subjectId: { type: Schema.Types.ObjectId, required: true },
    kind: {
      type: String,
      enum: ["birthday_card", "nameday_card", "user_birthday"],
      required: true,
    },
    daysLeft: { type: Number, required: true },
    // "YYYY-MM-DD" (Europe/Paris) — le jour couvert par ce rappel.
    sentDate: { type: String, required: true },
  },
  { timestamps: true },
);

reminderClaimSchema.index(
  { subjectId: 1, kind: 1, daysLeft: 1, sentDate: 1 },
  { unique: true },
);
// Purge automatique ~30 jours après création : évite une collection qui
// grossit indéfiniment sans qu'on ait à écrire un job de nettoyage.
reminderClaimSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 30 });

module.exports = model("ReminderClaim", reminderClaimSchema);
