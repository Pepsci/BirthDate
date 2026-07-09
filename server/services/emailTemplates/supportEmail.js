const { SESClient, SendEmailCommand } = require("@aws-sdk/client-ses");
const {
  emailHeader,
  emailFooter,
  badge,
  title,
  paragraph,
} = require("./emailHelpers");

const sesClient = new SESClient({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || "support@birthreminder.com";

/**
 * Envoie un message du formulaire de support à l'adresse support.
 * Le Reply-To est l'email de l'utilisateur pour répondre directement.
 */
const sendSupportEmail = async ({ fromEmail, fromName, subject, message }) => {
  const safeSubject = (subject || "Sans objet").slice(0, 150);
  const safeMessage = String(message || "").slice(0, 5000);
  const escaped = safeMessage.replace(/</g, "&lt;").replace(/\n/g, "<br/>");

  const html =
    emailHeader() +
    badge("Support 📨") +
    title(safeSubject) +
    paragraph(
      `<strong>De :</strong> ${fromName || "Utilisateur"} (${fromEmail})`,
    ) +
    paragraph(escaped) +
    emailFooter(
      `<p style="margin:0;font-size:12px;color:#6b7280;">Message envoyé depuis le formulaire de support de l'application.</p>`,
    );

  const params = {
    Source: `BirthReminder Support <${process.env.EMAIL_BRTHDAY}>`,
    Destination: { ToAddresses: [SUPPORT_EMAIL] },
    ReplyToAddresses: fromEmail ? [fromEmail] : undefined,
    Message: {
      Subject: {
        Data: `[Support] ${safeSubject}`,
        Charset: "UTF-8",
      },
      Body: {
        Html: { Data: html, Charset: "UTF-8" },
        Text: {
          Data: `De: ${fromName || "Utilisateur"} (${fromEmail})\nObjet: ${safeSubject}\n\n${safeMessage}`,
          Charset: "UTF-8",
        },
      },
    },
  };

  await sesClient.send(new SendEmailCommand(params));
  return { success: true };
};

module.exports = { sendSupportEmail };
