const crypto = require("crypto");
const { SESClient, SendEmailCommand } = require("@aws-sdk/client-ses");

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

  const params = {
    Source: `BirthReminder <${process.env.EMAIL_BRTHDAY}>`,
    Destination: {
      ToAddresses: [email],
    },
    Message: {
      Subject: {
        Data: "Vérifiez votre adresse email 📧",
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
  <title>Vérification email</title>
</head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;background-color:#1a1a2e;color:#ffffff;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color:#1a1a2e;">
    <tr>
      <td style="padding:40px 20px;">

        <!-- Carte principale -->
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width:600px;margin:0 auto;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);border-radius:16px;overflow:hidden;box-shadow:0 10px 40px rgba(0,0,0,0.3);">

          <!-- Header -->
          <tr>
            <td style="padding:40px 40px 20px 40px;text-align:center;">
              <h1 style="margin:0;font-size:32px;font-weight:700;letter-spacing:-0.5px;color:#ffffff;">
                🎉 BirthReminder
              </h1>
            </td>
          </tr>

          <!-- Badge -->
          <tr>
            <td style="padding:0 40px 20px 40px;text-align:center;">
              <div style="display:inline-block;background-color:rgba(255,255,255,0.2);padding:8px 20px;border-radius:20px;">
                <span style="font-size:14px;font-weight:600;text-transform:uppercase;letter-spacing:1px;color:#ffffff;">
                  Vérification email 📧
                </span>
              </div>
            </td>
          </tr>

          <!-- Message -->
          <tr>
            <td style="padding:0 40px 30px 40px;text-align:center;">
              <p style="margin:0;font-size:18px;line-height:1.6;color:rgba(255,255,255,0.95);">
                Merci de vous être inscrit sur <strong>BirthReminder</strong> !
              </p>
              <p style="margin:16px 0 0 0;font-size:15px;line-height:1.6;color:rgba(255,255,255,0.8);">
                Cliquez sur le bouton ci-dessous pour confirmer votre adresse email et activer votre compte.
              </p>
            </td>
          </tr>

          <!-- Bouton CTA -->
          <tr>
            <td style="padding:0 40px 40px 40px;text-align:center;">
              <a href="${verifyLink}" style="display:inline-block;background-color:#ffffff;color:#667eea;text-decoration:none;padding:16px 40px;border-radius:8px;font-weight:600;font-size:16px;box-shadow:0 4px 15px rgba(0,0,0,0.2);">
                Vérifier mon email →
              </a>
              <p style="margin:16px 0 0 0;font-size:12px;color:rgba(255,255,255,0.6);">
                Ce lien expire dans 24 heures.
              </p>
            </td>
          </tr>

        </table>

        <!-- Footer -->
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width:600px;margin:20px auto 0 auto;">
          <tr>
            <td style="padding:20px;text-align:center;font-size:12px;color:#888;line-height:1.6;">
              <p style="margin:0;">Si vous n'avez pas créé de compte sur BirthReminder, vous pouvez ignorer cet email.</p>
              <p style="margin:8px 0 0 0;">
                Ou copiez ce lien dans votre navigateur :<br>
                <span style="color:#667eea;word-break:break-all;">${verifyLink}</span>
              </p>
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
          Data: `Bienvenue sur BirthReminder !\n\nVérifiez votre email en cliquant sur ce lien :\n${verifyLink}\n\nCe lien expire dans 24 heures.\n\nSi vous n'avez pas créé de compte, ignorez cet email.`,
          Charset: "UTF-8",
        },
      },
    },
  };

  try {
    const command = new SendEmailCommand(params);
    await client.send(command);
    console.log("✅ Email de vérification envoyé à", email);
  } catch (err) {
    console.error("❌ Erreur envoi email de vérification :", err);
  }
}

module.exports = { generateVerificationToken, sendVerificationEmail };
