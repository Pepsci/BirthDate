const { SESClient, SendEmailCommand } = require("@aws-sdk/client-ses");

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

  const params = {
    Source: `BirthReminder <${process.env.EMAIL_BRTHDAY}>`,
    Destination: { ToAddresses: [recipientEmail] },
    Message: {
      Subject: {
        Data: `${senderUsername} vous invite sur BirthReminder 🎉`,
        Charset: "UTF-8",
      },
      Body: {
        Html: {
          Data: `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;background-color:#1a1a2e;color:#ffffff;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color:#1a1a2e;">
    <tr>
      <td style="padding:40px 20px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width:600px;margin:0 auto;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);border-radius:16px;overflow:hidden;box-shadow:0 10px 40px rgba(0,0,0,0.3);">
          <tr>
            <td style="padding:40px 40px 20px 40px;text-align:center;">
              <h1 style="margin:0;font-size:32px;font-weight:700;">🎉 BirthReminder</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:0 40px 20px 40px;text-align:center;">
              <div style="display:inline-block;background-color:rgba(255,255,255,0.2);padding:8px 20px;border-radius:20px;">
                <span style="font-size:14px;font-weight:600;text-transform:uppercase;letter-spacing:1px;">Invitation</span>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:0 40px 30px 40px;text-align:center;">
              <p style="margin:0;font-size:18px;line-height:1.6;color:rgba(255,255,255,0.95);">
                <strong>${senderUsername}</strong> vous invite à rejoindre BirthReminder et à devenir amis !
              </p>
              <p style="margin:16px 0 0 0;font-size:15px;line-height:1.6;color:rgba(255,255,255,0.8);">
                Ne manquez plus jamais l'anniversaire de vos proches 🎂
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 40px 40px 40px;text-align:center;">
              <a href="${registerLink}" style="display:inline-block;background-color:#ffffff;color:#667eea;text-decoration:none;padding:16px 40px;border-radius:8px;font-weight:600;font-size:16px;box-shadow:0 4px 15px rgba(0,0,0,0.2);">
                Créer mon compte →
              </a>
              <p style="margin:16px 0 0 0;font-size:12px;color:rgba(255,255,255,0.6);">
                Une fois inscrit, vous serez automatiquement ajouté comme ami avec ${senderUsername}
              </p>
            </td>
          </tr>
        </table>
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width:600px;margin:20px auto 0 auto;">
          <tr>
            <td style="padding:20px;text-align:center;font-size:12px;color:#888;">
              <p style="margin:0;">Si vous n'attendiez pas cette invitation, vous pouvez ignorer cet email.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
          Charset: "UTF-8",
        },
        Text: {
          Data: `${senderUsername} vous invite sur BirthReminder !\n\nCréez votre compte ici : ${registerLink}\n\nUne fois inscrit, vous serez automatiquement amis avec ${senderUsername}.`,
          Charset: "UTF-8",
        },
      },
    },
  };

  try {
    const command = new SendEmailCommand(params);
    await sesClient.send(command);
    console.log(`✅ Email d'invitation envoyé à ${recipientEmail}`);
    return { success: true };
  } catch (error) {
    console.error("❌ Erreur envoi email invitation:", error);
    return { success: false, error: error.message };
  }
};

module.exports = { sendInvitationEmail };
