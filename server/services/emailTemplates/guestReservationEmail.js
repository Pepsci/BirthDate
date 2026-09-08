// ============================================================
// server/services/emailTemplates/guestReservationEmail.js
// Accusé de réception envoyé au visiteur SANS COMPTE qui vient de réserver
// une idée depuis le lien public d'une liste commune.
//
// ⚠️ Ce mail n'est pas décoratif : il porte le lien de gestion.
//
// L'identité d'un visiteur anonyme tient dans un jeton tiré au hasard et
// rangé dans le `localStorage` de son navigateur. Ça suffit tant qu'il reste
// sur le même navigateur — et ça tombe dès qu'il réserve sur son téléphone
// puis rouvre le lien sur son ordinateur : plus de jeton, donc plus moyen de
// libérer sa propre réservation. Le lien ci-dessous remet le jeton (et le
// code de la liste) entre ses mains, sur n'importe quel appareil.
//
// L'adresse n'est utilisée que pour cet envoi unique. Elle n'est jamais
// renvoyée par l'API, ni aux membres de la liste, ni sur la page publique.
// ============================================================

const { SESClient, SendRawEmailCommand } = require("@aws-sdk/client-ses");
const nodemailer = require("nodemailer");
const {
  emailHeader,
  emailFooter,
  icon,
  title,
  paragraph,
  ctaButton,
  linkFallback,
  note,
} = require("./emailHelpers");

const ses = new SESClient({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const transporter = nodemailer.createTransport({
  SES: { ses, aws: { SendRawEmailCommand } },
});

/** Échappe ce qui vient du visiteur ou de la liste avant de l'injecter. */
const esc = (s) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/**
 * @param {object} p
 * @param {string} p.email       destinataire (saisi par le visiteur)
 * @param {string} p.guestName   prénom saisi
 * @param {string} p.giftName    idée réservée
 * @param {string} p.listLabel   libellé de la liste, s'il existe
 * @param {string} p.manageUrl   lien public + code + jeton
 */
async function sendGuestReservationEmail({
  email,
  guestName,
  giftName,
  listLabel,
  manageUrl,
}) {
  const forWhom = listLabel ? ` pour la liste « ${esc(listLabel)} »` : "";

  const html =
    emailHeader() +
    icon("🎁") +
    title("C'est noté, tu t'en occupes") +
    paragraph(
      `Bonjour ${esc(guestName)}, ta réservation de <strong>${esc(giftName)}</strong>${forWhom} est bien enregistrée. Personne d'autre ne pourra l'offrir.`,
    ) +
    ctaButton(manageUrl, "Voir ou libérer ma réservation") +
    linkFallback(manageUrl) +
    note(
      "Garde ce message : ce lien est le seul moyen de retrouver ta réservation depuis un autre téléphone ou un autre ordinateur. Si tu changes d'avis, libère-la — l'idée redeviendra disponible pour quelqu'un d'autre.",
    ) +
    emailFooter();

  await transporter.sendMail({
    from: "no-reply@birthreminder.com",
    to: email,
    subject: `🎁 Ta réservation : ${giftName}`,
    text:
      `Bonjour ${guestName},\n\n` +
      `Ta réservation de « ${giftName} »${listLabel ? ` pour la liste « ${listLabel} »` : ""} est bien enregistrée.\n\n` +
      `Pour la voir ou la libérer depuis n'importe quel appareil : ${manageUrl}\n\n` +
      `Garde ce lien : c'est le seul moyen de retrouver ta réservation ailleurs que sur le navigateur utilisé.`,
    html,
  });
}

module.exports = { sendGuestReservationEmail };
