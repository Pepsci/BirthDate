// ============================================================
// server/services/emailTemplates/contributionReceiptEmail.js
// Accusé de réception envoyé au contributeur après un paiement encaissé.
//
// ⚠️ Ce mail est une PREUVE, pas une politesse.
//
// Sur une charge directe, l'argent va sur le compte Stripe de l'organisateur
// et BirthReminder ne le détient jamais. Le jour où l'événement est annulé,
// le contributeur n'a donc qu'un interlocuteur — l'organisateur — et il ne
// peut rien lui opposer sans référence de paiement.
//
// Le reçu automatique de Stripe ne remplace pas celui-ci : sur une charge
// directe il est émis par le compte de l'ORGANISATEUR et dépend de SES
// réglages Stripe. S'il a coupé les emails de paiement, personne ne reçoit
// rien. Notre envoi, lui, ne dépend que de nous.
//
// D'où le bloc « en cas de problème » en bas : il dit, une fois, qui détient
// l'argent et dans quel ordre s'adresser à qui. C'est le seul document que le
// contributeur aura sous la main au moment où il en aura besoin.
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

/** Échappe ce qui vient du contributeur, de l'organisateur ou de l'événement. */
const esc = (s) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const euros = (cents) =>
  (Number(cents || 0) / 100).toLocaleString("fr-FR", {
    style: "currency",
    currency: "EUR",
  });

/**
 * @param {object} p
 * @param {string} p.email           destinataire
 * @param {string} [p.guestName]     prénom affiché, s'il a été saisi
 * @param {number} p.amount          montant en centimes
 * @param {string} p.eventTitle      titre de l'événement
 * @param {string} p.eventShortId    identifiant court, pour le lien
 * @param {string} p.organizerName   organisateur qui encaisse
 * @param {string} p.reference       référence de paiement (PaymentIntent)
 * @param {Date}   [p.paidAt]        date d'encaissement
 */
async function sendContributionReceiptEmail({
  email,
  guestName,
  amount,
  eventTitle,
  eventShortId,
  organizerName,
  reference,
  paidAt,
}) {
  const frontendUrl = process.env.FRONTEND_URL || "https://birthreminder.com";
  const eventUrl = `${frontendUrl}/event/${eventShortId}`;
  const helpUrl = `${frontendUrl}/contact`;

  const dateLabel = new Date(paidAt || Date.now()).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const hello = guestName ? `Bonjour ${esc(guestName)}, ` : "Bonjour, ";

  // Le récapitulatif en tableau plutôt qu'en phrases : c'est ce qu'on recopie
  // dans un message à l'organisateur ou dans un ticket au support.
  const rows = [
    ["Montant", `<strong>${euros(amount)}</strong>`],
    ["Événement", esc(eventTitle)],
    ["Encaissé par", esc(organizerName)],
    ["Date", dateLabel],
    ["Référence", `<code style="font-size:13px;">${esc(reference)}</code>`],
  ]
    .map(
      ([k, v]) =>
        `<tr>
           <td style="padding:6px 12px 6px 0;color:#6b7280;font-size:14px;white-space:nowrap;">${k}</td>
           <td style="padding:6px 0;color:#111827;font-size:14px;">${v}</td>
         </tr>`,
    )
    .join("");

  const html =
    emailHeader() +
    icon("💝") +
    title("Ta contribution est bien enregistrée") +
    paragraph(
      `${hello}merci pour ta participation à la cagnotte de <strong>${esc(eventTitle)}</strong>.`,
    ) +
    `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:16px auto;border-collapse:collapse;">${rows}</table>` +
    ctaButton(eventUrl, "Voir l'événement") +
    linkFallback(eventUrl) +
    note(
      `<strong>Conserve ce message : c'est ta preuve de paiement.</strong><br><br>` +
        `L'argent a été encaissé <strong>directement sur le compte Stripe de ${esc(organizerName)}</strong>. ` +
        `BirthReminder ne détient jamais les fonds et ne peut donc pas rembourser à sa place.<br><br>` +
        `Si l'événement est annulé ou si le cadeau n'est finalement pas acheté, c'est à ${esc(organizerName)} ` +
        `de te rembourser : contacte-le d'abord, en lui donnant la référence ci-dessus. ` +
        `Si tu restes sans réponse, écris-nous — nous ne pouvons pas trancher un désaccord, ` +
        `mais nous pouvons confirmer ce paiement et relancer l'organisateur : ${helpUrl}`,
    ) +
    emailFooter();

  await transporter.sendMail({
    from: "no-reply@birthreminder.com",
    to: email,
    subject: `💝 Reçu de ta contribution — ${eventTitle}`,
    text:
      `${guestName ? `Bonjour ${guestName},` : "Bonjour,"}\n\n` +
      `Merci pour ta participation à la cagnotte de « ${eventTitle} ».\n\n` +
      `Montant : ${euros(amount)}\n` +
      `Événement : ${eventTitle}\n` +
      `Encaissé par : ${organizerName}\n` +
      `Date : ${dateLabel}\n` +
      `Référence : ${reference}\n\n` +
      `Conserve ce message : c'est ta preuve de paiement.\n\n` +
      `L'argent a été encaissé directement sur le compte Stripe de ${organizerName}. ` +
      `BirthReminder ne détient jamais les fonds et ne peut pas rembourser à sa place.\n\n` +
      `Si l'événement est annulé ou si le cadeau n'est pas acheté, c'est à ${organizerName} de te rembourser : ` +
      `contacte-le d'abord avec la référence ci-dessus. Sans réponse de sa part, écris-nous : ${helpUrl}\n\n` +
      `L'événement : ${eventUrl}`,
    html,
  });
}

module.exports = { sendContributionReceiptEmail };
