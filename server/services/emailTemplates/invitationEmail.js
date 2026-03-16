const { SESClient, SendEmailCommand } = require("@aws-sdk/client-ses");
const {
  emailHeader,
  emailFooter,
  badge,
  title,
  paragraph,
  ctaButton,
  note,
} = require("./emailHelpers");

const sesClient = new SESClient({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const sendInvitationEmail = async (recipientEmail, senderUsername, token) => {
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
  const registerLink = `${frontendUrl}/signup?invitationToken=${token}`;

  const html =
    emailHeader() +
    badge("Invitation 🎉") +
    title(`${senderUsername} vous invite !`) +
    paragraph(
      `<strong>${senderUsername}</strong> vous invite à rejoindre BirthReminder et à devenir amis ! Ne manquez plus jamais l'anniversaire de vos proches 🎂`,
    ) +
    ctaButton(registerLink, "Créer mon compte") +
    note(
      `Une fois inscrit, vous serez automatiquement ajouté comme ami avec ${senderUsername}.`,
    ) +
    emailFooter(
      `<p style="margin:0 0 8px;font-size:12px;color:#6b7280;">Si vous n'attendiez pas cette invitation, vous pouvez ignorer cet email.</p>`,
    );

  const params = {
    Source: `BirthReminder <${process.env.EMAIL_BRTHDAY}>`,
    Destination: { ToAddresses: [recipientEmail] },
    Message: {
      Subject: {
        Data: `${senderUsername} vous invite sur BirthReminder 🎉`,
        Charset: "UTF-8",
      },
      Body: {
        Html: { Data: html, Charset: "UTF-8" },
        Text: {
          Data: `${senderUsername} vous invite sur BirthReminder !\n\nCréez votre compte ici : ${registerLink}\n\nUne fois inscrit, vous serez automatiquement amis avec ${senderUsername}.`,
          Charset: "UTF-8",
        },
      },
    },
  };

  try {
    await sesClient.send(new SendEmailCommand(params));
    console.log(`✅ Email d'invitation envoyé à ${recipientEmail}`);
    return { success: true };
  } catch (error) {
    console.error("❌ Erreur envoi email invitation:", error);
    return { success: false, error: error.message };
  }
};

module.exports = { sendInvitationEmail };
