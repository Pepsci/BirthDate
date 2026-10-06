// Version anglaise de l'email de vérification (services/verififcation.js).
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
} = require("./emailHelpers");

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
    title("Verify your email address") +
    paragraph(
      "Thank you for signing up to <strong>BirthReminder</strong>! Click the button below to confirm your email address and activate your account.",
    ) +
    ctaButton(verifyLink, "Verify my email") +
    note("This link expires in 24 hours.") +
    linkFallback(verifyLink) +
    emailFooter(
      `<p style="margin:0 0 8px;font-size:12px;color:#6b7280;">If you did not create a BirthReminder account, you can ignore this email.</p>`,
    );

  const params = {
    Source: `BirthReminder <${process.env.EMAIL_BRTHDAY}>`,
    Destination: { ToAddresses: [email] },
    Message: {
      Subject: { Data: "Verify your email address 📧", Charset: "UTF-8" },
      Body: {
        Html: { Data: html, Charset: "UTF-8" },
        Text: {
          Data: `Welcome to BirthReminder!\n\nVerify your email: ${verifyLink}\n\nThis link expires in 24 hours.`,
          Charset: "UTF-8",
        },
      },
    },
  };

  try {
    await client.send(new SendEmailCommand(params));
    console.log("✅ Email de vérification (en) envoyé à", email);
  } catch (err) {
    console.error("❌ Erreur envoi email de vérification (en) :", err);
  }
}

module.exports = { sendVerificationEmail };
