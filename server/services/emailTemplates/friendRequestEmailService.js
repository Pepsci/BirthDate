// services/emailTemplates/friendRequestEmailService.js

const { SESClient, SendEmailCommand } = require("@aws-sdk/client-ses");

// Création du client SES avec AWS SDK v3 (comme dans birthdayEmailService.js)
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

  const params = {
    Source: `BirthReminder <${process.env.EMAIL_BRTHDAY}>`, // Utilise le même email que pour les anniversaires
    Destination: {
      ToAddresses: [recipientEmail],
    },
    Message: {
      Subject: {
        Data: `${senderUsername} vous a envoyé une demande d'ami sur BirthReminder`,
        Charset: "UTF-8",
      },
      Body: {
        Html: {
          Data: `
            <!DOCTYPE html>
            <html>
              <head>
                <meta charset="UTF-8">
                <style>
                  body { 
                    font-family: Arial, sans-serif; 
                    line-height: 1.6; 
                    color: #333; 
                    margin: 0; 
                    padding: 0;
                  }
                  .container { 
                    max-width: 600px; 
                    margin: 0 auto; 
                    padding: 20px; 
                  }
                  .header { 
                    background-color: #4CAF50; 
                    color: white; 
                    padding: 20px; 
                    text-align: center; 
                    border-radius: 8px 8px 0 0;
                  }
                  .content { 
                    background-color: #f9f9f9; 
                    padding: 30px; 
                    border-radius: 0 0 8px 8px;
                  }
                  .button { 
                    display: inline-block;
                    background-color: #4CAF50; 
                    color: white; 
                    padding: 12px 30px; 
                    text-decoration: none; 
                    border-radius: 5px; 
                    margin: 20px 0;
                    font-weight: bold;
                  }
                  .button:hover {
                    background-color: #45a049;
                  }
                  .footer { 
                    color: #666; 
                    font-size: 14px; 
                    margin-top: 30px; 
                    padding-top: 20px; 
                    border-top: 1px solid #ddd;
                  }
                  .unsubscribe {
                    font-size: 12px;
                    color: #999;
                    margin-top: 20px;
                    text-align: center;
                  }
                  .unsubscribe a {
                    color: #999;
                    text-decoration: underline;
                  }
                  ul {
                    padding-left: 20px;
                  }
                  li {
                    margin: 8px 0;
                  }
                </style>
              </head>
              <body>
                <div class="container">
                  <div class="header">
                    <h1>🎉 Nouvelle demande d'ami !</h1>
                  </div>
                  
                  <div class="content">
                    <p>Bonjour,</p>
                    
                    <p><strong>${senderUsername}</strong> souhaite devenir votre ami sur BirthReminder.</p>
                    
                    <p>En acceptant cette demande, vous pourrez :</p>
                    <ul>
                      <li>Consulter les listes de souhaits de ${senderUsername}</li>
                      <li>Partager vos propres listes de souhaits</li>
                      <li>Ne plus oublier les anniversaires de vos proches</li>
                    </ul>
                    
                    <div style="text-align: center; margin: 30px 0;">
                      <a href="${frontendUrl}/friends" class="button">
                        Voir les demandes d'ami
                      </a>
                    </div>
                    
                    <div class="footer">
                      <p>💡 Connectez-vous à votre compte pour accepter ou refuser cette demande.</p>
                      <p style="color: #999; font-size: 12px;">
                        Si vous n'avez pas de compte BirthReminder ou si vous pensez avoir reçu cet email par erreur, 
                        vous pouvez l'ignorer en toute sécurité.
                      </p>
                    </div>
                    
                    <div class="unsubscribe">
                      <p>
                        Vous ne souhaitez plus recevoir ces notifications ? 
                        <a href="${frontendUrl}/api/unsubscribe?email=${encodeURIComponent(recipientEmail)}&type=friend_requests">
                          Se désabonner
                        </a>
                      </p>
                    </div>
                  </div>
                </div>
              </body>
            </html>
          `,
          Charset: "UTF-8",
        },
        Text: {
          Data: `
Nouvelle demande d'ami sur BirthReminder

Bonjour,

${senderUsername} souhaite devenir votre ami sur BirthReminder.

En acceptant cette demande, vous pourrez :
- Consulter les listes de souhaits de ${senderUsername}
- Partager vos propres listes de souhaits
- Ne plus oublier les anniversaires de vos proches

Connectez-vous à ${frontendUrl}/friends pour accepter ou refuser cette demande.

Si vous n'avez pas de compte BirthReminder, vous pouvez ignorer cet email.

---
Pour ne plus recevoir ces notifications : ${frontendUrl}/api/unsubscribe?email=${encodeURIComponent(recipientEmail)}&type=friend_requests

BirthReminder - Ne manquez plus jamais un anniversaire
          `,
          Charset: "UTF-8",
        },
      },
    },
  };

  try {
    const command = new SendEmailCommand(params);
    const result = await sesClient.send(command);
    console.log(`✅ Email de demande d'ami envoyé à ${recipientEmail}`);
    console.log("Message ID:", result.MessageId);
    return { success: true, messageId: result.MessageId };
  } catch (error) {
    console.error("❌ Erreur envoi email demande d'ami:", error);
    // Ne pas faire échouer la requête si l'email ne part pas
    return { success: false, error: error.message };
  }
};

module.exports = {
  sendFriendRequestNotification,
};
