// Version anglaise de ../invitationEmail.js
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
    title(`${senderUsername} invites you!`) +
    paragraph(
      `<strong>${senderUsername}</strong> invites you to join BirthReminder and become friends! Never miss a loved one's birthday again 🎂`,
    ) +
    ctaButton(registerLink, "Create my account") +
    note(
      `Once you have signed up, you will automatically be added as a friend of ${senderUsername}.`,
    ) +
    emailFooter(
      `<p style="margin:0 0 8px;font-size:12px;color:#6b7280;">If you were not expecting this invitation, you can ignore this email.</p>`,
    );

  const params = {
    Source: `BirthReminder <${process.env.EMAIL_BRTHDAY}>`,
    Destination: { ToAddresses: [recipientEmail] },
    Message: {
      Subject: {
        Data: `${senderUsername} invites you to BirthReminder 🎉`,
        Charset: "UTF-8",
      },
      Body: {
        Html: { Data: html, Charset: "UTF-8" },
        Text: {
          Data: `${senderUsername} invites you to BirthReminder!\n\nCreate your account here: ${registerLink}\n\nOnce you have signed up, you will automatically be friends with ${senderUsername}.`,
          Charset: "UTF-8",
        },
      },
    },
  };

  try {
    await sesClient.send(new SendEmailCommand(params));
    console.log(`✅ Email d'invitation (en) envoyé à ${recipientEmail}`);
    return { success: true };
  } catch (error) {
    console.error("❌ Erreur envoi email invitation (en):", error);
    return { success: false, error: error.message };
  }
};

module.exports = { sendInvitationEmail };
