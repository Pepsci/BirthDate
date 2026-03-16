const { SESClient, SendRawEmailCommand } = require("@aws-sdk/client-ses");
const nodemailer = require("nodemailer");

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

  const html = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Réinitialisation de mot de passe</title>
</head>
<body style="margin:0;padding:0;background-color:#f3f4f6;font-family:'Roboto',Arial,sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f3f4f6;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;">

          <!-- HEADER -->
          <tr>
            <td align="center" style="padding-bottom:24px;">
              <img
                src="https://birthreminder.com/logo-email.png"
                alt="BirthReminder"
                width="120"
                height="120"
                style="display:block;margin:0 auto 12px;"
              />
              <span style="font-size:22px;font-weight:700;color:#111827;letter-spacing:-0.3px;">
                BirthReminder
              </span>
            </td>
          </tr>

          <!-- CARD -->
          <tr>
            <td style="
              background:#ffffff;
              border-radius:16px;
              border:1px solid #e5e7eb;
              padding:40px 36px 32px;
            ">
              <table width="100%" cellpadding="0" cellspacing="0">

                <!-- ICON -->
                <tr>
                  <td align="center" style="padding-bottom:24px;">
                    <div style="
                      width:56px;
                      height:56px;
                      background-color:#3b82f6;
                      border-radius:50%;
                      -webkit-border-radius:50%;
                      mso-border-radius:50%;
                      text-align:center;
                      font-size:26px;
                      line-height:56px;
                      margin:0 auto;
                    ">🔑</div>
                  </td>
                </tr>

                <!-- TITRE -->
                <tr>
                  <td align="center" style="padding-bottom:8px;">
                    <h1 style="
                      margin:0;
                      font-size:20px;
                      font-weight:600;
                      color:#111827;
                      letter-spacing:-0.2px;
                    ">Réinitialisation de mot de passe</h1>
                  </td>
                </tr>

                <!-- TEXTE -->
                <tr>
                  <td align="center" style="padding-bottom:32px;">
                    <p style="
                      margin:0;
                      font-size:14px;
                      color:#6b7280;
                      line-height:1.6;
                      max-width:360px;
                    ">
                      Vous avez demandé à réinitialiser votre mot de passe BirthReminder.
                      Cliquez sur le bouton ci-dessous pour choisir un nouveau mot de passe.
                    </p>
                  </td>
                </tr>

                <!-- BOUTON -->
                <tr>
                  <td align="center" style="padding-bottom:32px;">
                    <a
                      href="${resetUrl}"
                      style="
                        display:inline-block;
                        background:#3b82f6;
                        color:#ffffff;
                        text-decoration:none;
                        font-size:15px;
                        font-weight:600;
                        padding:14px 36px;
                        border-radius:11px;
                        letter-spacing:0.01em;
                      "
                    >
                      Réinitialiser mon mot de passe
                    </a>
                  </td>
                </tr>

                <!-- SÉPARATEUR -->
                <tr>
                  <td style="border-top:1px solid #e5e7eb;padding-top:24px;padding-bottom:16px;">
                    <p style="
                      margin:0;
                      font-size:12px;
                      color:#9ca3af;
                      text-align:center;
                      line-height:1.6;
                    ">
                      Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :
                    </p>
                  </td>
                </tr>

                <!-- LIEN TEXTE -->
                <tr>
                  <td align="center" style="padding-bottom:24px;">
                    <a
                      href="${resetUrl}"
                      style="
                        font-size:12px;
                        color:#3b82f6;
                        word-break:break-all;
                        text-decoration:none;
                      "
                    >${resetUrl}</a>
                  </td>
                </tr>

                <!-- AVERTISSEMENT -->
                <tr>
                  <td style="
                    background:#fef9c3;
                    border:1px solid #fde047;
                    border-radius:10px;
                    padding:12px 16px;
                  ">
                    <p style="
                      margin:0;
                      font-size:12px;
                      color:#713f12;
                      line-height:1.5;
                      text-align:center;
                    ">
                      ⏱ Ce lien expire dans <strong>1 heure</strong>.
                      Si vous n'avez pas fait cette demande, ignorez cet email.
                    </p>
                  </td>
                </tr>

              </table>
            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td align="center" style="padding-top:24px;">
              <p style="
                margin:0;
                font-size:12px;
                color:#9ca3af;
                line-height:1.6;
              ">
                © 2026 BirthReminder · Fait avec ❤️ par Joss Filippi
              </p>
              <p style="margin:4px 0 0;font-size:12px;color:#d1d5db;">
                Conformité RGPD · LCEN · CNIL
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>
  `;

  try {
    await transporter.sendMail({
      from: "reset_password@birthreminder.com",
      to: email,
      subject: "Réinitialisation de votre mot de passe BirthReminder",
      text: `Réinitialisez votre mot de passe BirthReminder en cliquant sur ce lien (valide 1h) : ${resetUrl}`,
      html,
    });
    console.log("Email de reset envoyé avec succès !");
  } catch (error) {
    console.error("Erreur lors de l'envoi de l'email de reset :", error);
    throw new Error("Échec de l'envoi de l'email");
  }
}

module.exports = { sendPasswordResetEmail };
