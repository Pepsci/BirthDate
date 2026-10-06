// Version anglaise de ../passwordResetEmail.js
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
    title("Password reset") +
    paragraph(
      "You asked to reset your BirthReminder password. Click the button below to choose a new password.",
    ) +
    ctaButton(resetUrl, "Reset my password") +
    linkFallback(resetUrl) +
    warning(
      "⏱ This link expires in <strong>30 minutes</strong>. If you did not make this request, you can ignore this email.",
    ) +
    emailFooter();

  try {
    await transporter.sendMail({
      from: "reset_password@birthreminder.com",
      to: email,
      subject: "Reset your BirthReminder password",
      text: `Reset your password by clicking this link (valid for 30 minutes): ${resetUrl}`,
      html,
    });
    console.log("✅ Email de reset (en) envoyé à", email);
  } catch (error) {
    console.error("❌ Erreur envoi email reset (en) :", error);
    throw new Error("Échec de l'envoi de l'email");
  }
}

module.exports = { sendPasswordResetEmail };
