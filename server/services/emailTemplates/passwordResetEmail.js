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
  warning,
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

async function sendPasswordResetEmail(email, token) {
  const resetUrl = `${process.env.FRONTEND_URL}/auth/reset/${token}`;

  const html =
    emailHeader() +
    icon("🔑") +
    title("Réinitialisation de mot de passe") +
    paragraph(
      "Vous avez demandé à réinitialiser votre mot de passe BirthReminder. Cliquez sur le bouton ci-dessous pour choisir un nouveau mot de passe.",
    ) +
    ctaButton(resetUrl, "Réinitialiser mon mot de passe") +
    linkFallback(resetUrl) +
    warning(
      "⏱ Ce lien expire dans <strong>1 heure</strong>. Si vous n'avez pas fait cette demande, ignorez cet email.",
    ) +
    emailFooter();

  try {
    await transporter.sendMail({
      from: "reset_password@birthreminder.com",
      to: email,
      subject: "Réinitialisation de votre mot de passe BirthReminder",
      text: `Réinitialisez votre mot de passe en cliquant sur ce lien (valide 1h) : ${resetUrl}`,
      html,
    });
    console.log("✅ Email de reset envoyé à", email);
  } catch (error) {
    console.error("❌ Erreur envoi email reset :", error);
    throw new Error("Échec de l'envoi de l'email");
  }
}

module.exports = { sendPasswordResetEmail };
