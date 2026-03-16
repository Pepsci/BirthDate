const crypto = require("crypto");
const { SESClient, SendEmailCommand } = require("@aws-sdk/client-ses");
const {
  emailHeader,
  emailFooter,
  icon,
  title,
  paragraph,
  ctaButton,
  note,
  linkFallback,
} = require("./emailTemplates/emailHelpers");

function generateVerificationToken() {
  return crypto.randomBytes(32).toString("hex");
}

async function sendVerificationEmail(email, token) {
  const client = new SESClient({
    region: process.env.AWS_REGION,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  });

  const verifyLink = `${process.env.FRONTEND_URL}/verify-email/?token=${token}`;

  const html =
    emailHeader() +
    icon("📧") +
    title("Vérifiez votre adresse email") +
    paragraph(
      "Merci de vous être inscrit sur <strong>BirthReminder</strong> ! Cliquez sur le bouton ci-dessous pour confirmer votre adresse email et activer votre compte.",
    ) +
    ctaButton(verifyLink, "Vérifier mon email") +
    note("Ce lien expire dans 24 heures.") +
    linkFallback(verifyLink) +
    emailFooter(
      `<p style="margin:0 0 8px;font-size:12px;color:#6b7280;">Si vous n'avez pas créé de compte sur BirthReminder, ignorez cet email.</p>`,
    );

  const params = {
    Source: `BirthReminder <${process.env.EMAIL_BRTHDAY}>`,
    Destination: { ToAddresses: [email] },
    Message: {
      Subject: { Data: "Vérifiez votre adresse email 📧", Charset: "UTF-8" },
      Body: {
        Html: { Data: html, Charset: "UTF-8" },
        Text: {
          Data: `Bienvenue sur BirthReminder !\n\nVérifiez votre email : ${verifyLink}\n\nCe lien expire dans 24 heures.`,
          Charset: "UTF-8",
        },
      },
    },
  };

  try {
    await client.send(new SendEmailCommand(params));
    console.log("✅ Email de vérification envoyé à", email);
  } catch (err) {
    console.error("❌ Erreur envoi email de vérification :", err);
  }
}

module.exports = { generateVerificationToken, sendVerificationEmail };
