// Version anglaise de ../friendRequestEmailService.js
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
const { unsubscribeSignature } = require("../../../utils/unsubscribeLinks");

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
  const unsubscribeLink = `${frontendUrl}/api/unsubscribe?email=${encodeURIComponent(recipientEmail)}&type=friend_requests&sig=${unsubscribeSignature(recipientEmail, "friend_requests")}`;

  const html =
    emailHeader() +
    badge("New friend request 👥") +
    title(`${senderUsername} wants to be your friend`) +
    paragraph(
      `<strong>${senderUsername}</strong> would like to be your friend on BirthReminder! By accepting, you will be able to share your wishlists and never forget each other's birthdays 🎂`,
    ) +
    ctaButton(friendsLink, "View the request") +
    note("Log in to accept or decline this request.") +
    emailFooter(`
      <p style="margin:0 0 6px;font-size:12px;color:#6b7280;">
        No longer want these notifications?
        <a href="${unsubscribeLink}" style="color:#818cf8;text-decoration:none;">Unsubscribe</a>
      </p>
    `);

  const params = {
    Source: `BirthReminder <${process.env.EMAIL_BRTHDAY}>`,
    Destination: { ToAddresses: [recipientEmail] },
    Message: {
      Subject: {
        Data: `${senderUsername} sent you a friend request 👥`,
        Charset: "UTF-8",
      },
      Body: {
        Html: { Data: html, Charset: "UTF-8" },
        Text: {
          Data: `${senderUsername} sent you a friend request on BirthReminder!\n\nView the request: ${friendsLink}`,
          Charset: "UTF-8",
        },
      },
    },
  };

  try {
    await sesClient.send(new SendEmailCommand(params));
    console.log(`✅ Email de demande d'ami (en) envoyé à ${recipientEmail}`);
    return { success: true };
  } catch (error) {
    console.error("❌ Erreur envoi email demande d'ami (en):", error);
    return { success: false, error: error.message };
  }
};

module.exports = { sendFriendRequestNotification };
