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

const sendFriendRequestNotification = async (
  recipientEmail,
  senderUsername,
  recipientId,
) => {
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
  const friendsLink = `${frontendUrl}/home?tab=friends&section=received`;
  const unsubscribeLink = `${frontendUrl}/api/unsubscribe?email=${encodeURIComponent(recipientEmail)}&type=friend_requests`;

  const html =
    emailHeader() +
    badge("Nouvelle demande d'ami 👥") +
    title(`${senderUsername} veut être votre ami`) +
    paragraph(
      `<strong>${senderUsername}</strong> souhaite devenir votre ami sur BirthReminder ! En acceptant, vous pourrez partager vos listes de souhaits et ne plus oublier vos anniversaires 🎂`,
    ) +
    ctaButton(friendsLink, "Voir la demande") +
    note("Connectez-vous pour accepter ou refuser cette demande.") +
    emailFooter(`
      <p style="margin:0 0 6px;font-size:12px;color:#6b7280;">
        Vous ne souhaitez plus recevoir ces notifications ?
        <a href="${unsubscribeLink}" style="color:#818cf8;text-decoration:none;">Se désabonner</a>
      </p>
    `);

  const params = {
    Source: `BirthReminder <${process.env.EMAIL_BRTHDAY}>`,
    Destination: { ToAddresses: [recipientEmail] },
    Message: {
      Subject: {
        Data: `${senderUsername} vous a envoyé une demande d'ami 👥`,
        Charset: "UTF-8",
      },
      Body: {
        Html: { Data: html, Charset: "UTF-8" },
        Text: {
          Data: `${senderUsername} vous a envoyé une demande d'ami sur BirthReminder !\n\nVoir la demande : ${friendsLink}`,
          Charset: "UTF-8",
        },
      },
    },
  };

  try {
    await sesClient.send(new SendEmailCommand(params));
    console.log(`✅ Email de demande d'ami envoyé à ${recipientEmail}`);
    return { success: true };
  } catch (error) {
    console.error("❌ Erreur envoi email demande d'ami:", error);
    return { success: false, error: error.message };
  }
};

module.exports = { sendFriendRequestNotification };
