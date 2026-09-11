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

/**
 * Envoie la réponse d'un admin à un ticket de support ouvert sans compte
 * (formulaire public). C'est le seul canal de retour possible pour ces
 * visiteurs : pas de connexion donc pas de fil dans l'app.
 */
const sendSupportReplyEmail = async ({ toEmail, toName, subject, message }) => {
  const safeSubject = (subject || "Ta demande de support").slice(0, 150);
  const safeMessage = String(message || "").slice(0, 5000);
  const escaped = safeMessage.replace(/</g, "&lt;").replace(/\n/g, "<br/>");

  const html =
    emailHeader() +
    badge("Réponse du support 💬") +
    title(safeSubject) +
    paragraph(`Bonjour ${toName || ""},`.trim()) +
    paragraph(escaped) +
    paragraph(
      `<em>Cet email est envoyé automatiquement, merci de ne pas y répondre directement (cette adresse n'est pas surveillée). Si tu as une autre question, ouvre un nouveau message sur <a href="https://birthreminder.com/contact">birthreminder.com/contact</a>.</em>`,
    ) +
    emailFooter(
      `<p style="margin:0;font-size:12px;color:#6b7280;">Réponse à ta demande envoyée depuis le formulaire de support de BirthReminder.</p>`,
    );

  const params = {
    Source: `BirthReminder Support <${process.env.EMAIL_BRTHDAY}>`,
    // Adresse factice, volontairement non surveillée : contrairement à
    // sendSupportEmail (où le Reply-To pointe vers l'utilisateur pour que
    // l'admin puisse répondre depuis son client mail), ici c'est l'admin qui
    // écrit — une réponse du visiteur ne doit pas atterrir dans une boîte
    // que personne ne lit. Le paragraphe ci-dessus l'explique clairement.
    ReplyToAddresses: ["no-reply@birthreminder.com"],
    Destination: { ToAddresses: [toEmail] },
    Message: {
      Subject: {
        Data: `Re: ${safeSubject}`,
        Charset: "UTF-8",
      },
      Body: {
        Html: { Data: html, Charset: "UTF-8" },
        Text: {
          Data: `Bonjour ${toName || ""},\n\n${safeMessage}\n\n---\nCet email est envoye automatiquement, merci de ne pas y repondre directement (cette adresse n'est pas surveillee). Si tu as une autre question, ouvre un nouveau message sur https://birthreminder.com/contact`,
          Charset: "UTF-8",
        },
      },
    },
  };

  await sesClient.send(new SendEmailCommand(params));
  return { success: true };
};

module.exports = { sendSupportReplyEmail };
