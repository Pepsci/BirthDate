/**
 * Choix de la langue des emails.
 *
 *   const { emailsFor } = require("../services/emailTemplates/localized");
 *   await emailsFor(user.language).sendPasswordResetEmail(email, token);
 *
 * Les templates français restent la référence, inchangés. Leurs équivalents
 * anglais vivent dans `./en/`, avec les MÊMES noms de fonctions et les MÊMES
 * paramètres : `emailsFor()` ne fait que renvoyer le bon jeu.
 *
 * Règles de langue, à respecter par les appelants :
 *   - destinataire avec compte  → SA langue (`User.language`) ;
 *   - destinataire sans compte  → la langue de celui qui est à l'origine de
 *     l'email (l'ami qui invite, l'organisateur de l'événement) ;
 *   - langue inconnue (null)    → français.
 *
 * Ajouter une langue : créer `./<code>/` avec les mêmes fichiers, puis
 * l'ajouter à SETS ci-dessous. Un email absent d'une langue retombe tout seul
 * sur sa version française.
 */
const { normalizeLanguage } = require("../../i18n");

const fr = {
  sendVerificationEmail: require("../verififcation").sendVerificationEmail,
  ...require("./passwordResetEmail"),
  ...require("./friendRequestEmailService"),
  ...require("./invitationEmail"),
  ...require("./eventEmails"),
  ...require("./birthdayReminder"),
  ...require("./namedayReminder"),
  ...require("./monthlyRecapEmail"),
  ...require("./contributionReceiptEmail"),
};

const en = {
  ...require("./en/verificationEmail"),
  ...require("./en/passwordResetEmail"),
  ...require("./en/friendRequestEmailService"),
  ...require("./en/invitationEmail"),
  ...require("./en/eventEmails"),
  ...require("./en/birthdayReminder"),
  ...require("./en/namedayReminder"),
  ...require("./en/monthlyRecapEmail"),
  ...require("./en/contributionReceiptEmail"),
};

const SETS = { fr, en: { ...fr, ...en } };

/** Jeu de fonctions d'envoi pour une langue ("en", "en-GB", null…). */
function emailsFor(language) {
  return SETS[normalizeLanguage(language)] || fr;
}

module.exports = { emailsFor };
