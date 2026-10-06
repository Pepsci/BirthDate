// Version anglaise de ../contributionReceiptEmail.js : même fonction, mêmes
// paramètres. Voir l'original pour le pourquoi de ce mail (c'est une PREUVE
// de paiement, pas une politesse).
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

const esc = (s) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const euros = (cents) =>
  (Number(cents || 0) / 100).toLocaleString("en-GB", {
    style: "currency",
    currency: "EUR",
  });

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

  const dateLabel = new Date(paidAt || Date.now()).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const hello = guestName ? `Hello ${esc(guestName)}, ` : "Hello, ";

  const rows = [
    ["Amount", `<strong>${euros(amount)}</strong>`],
    ["Event", esc(eventTitle)],
    ["Collected by", esc(organizerName)],
    ["Date", dateLabel],
    ["Reference", `<code style="font-size:13px;">${esc(reference)}</code>`],
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
    title("Your contribution has been recorded") +
    paragraph(
      `${hello}thank you for contributing to the gift pool for <strong>${esc(eventTitle)}</strong>.`,
    ) +
    `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:16px auto;border-collapse:collapse;">${rows}</table>` +
    ctaButton(eventUrl, "See the event") +
    linkFallback(eventUrl) +
    note(
      `<strong>Keep this message: it is your proof of payment.</strong><br><br>` +
        `The money was collected <strong>directly on ${esc(organizerName)}'s Stripe account</strong>. ` +
        `BirthReminder never holds the funds and therefore cannot issue a refund on their behalf.<br><br>` +
        `If the event is cancelled or the gift is not bought in the end, it is up to ${esc(organizerName)} ` +
        `to refund you: contact them first and give them the reference above. ` +
        `If you get no answer, write to us. We cannot settle a disagreement, ` +
        `but we can confirm this payment and follow up with the organizer: ${helpUrl}`,
    ) +
    emailFooter();

  await transporter.sendMail({
    from: "no-reply@birthreminder.com",
    to: email,
    subject: `💝 Receipt for your contribution: ${eventTitle}`,
    text:
      `${guestName ? `Hello ${guestName},` : "Hello,"}\n\n` +
      `Thank you for contributing to the gift pool for "${eventTitle}".\n\n` +
      `Amount: ${euros(amount)}\n` +
      `Event: ${eventTitle}\n` +
      `Collected by: ${organizerName}\n` +
      `Date: ${dateLabel}\n` +
      `Reference: ${reference}\n\n` +
      `Keep this message: it is your proof of payment.\n\n` +
      `The money was collected directly on ${organizerName}'s Stripe account. ` +
      `BirthReminder never holds the funds and cannot issue a refund on their behalf.\n\n` +
      `If the event is cancelled or the gift is not bought, it is up to ${organizerName} to refund you: ` +
      `contact them first with the reference above. If they do not answer, write to us: ${helpUrl}\n\n` +
      `The event: ${eventUrl}`,
    html,
  });
}

module.exports = { sendContributionReceiptEmail };
