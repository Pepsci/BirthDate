/**
 * Helpers partagés pour les templates email BirthReminder
 * Style : fond sombre #1a1a2e + gradient violet
 */

const LOGO_URL = "https://birthreminder.com/logo-email.png";
const FRONTEND_URL = process.env.FRONTEND_URL || "https://birthreminder.com";
const YEAR = new Date().getFullYear();

/**
 * Génère le header commun à tous les emails
 */
function emailHeader() {
  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
</head>
<body style="margin:0;padding:0;background-color:#1a1a2e;font-family:'Roboto',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#1a1a2e;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:540px;">

          <!-- LOGO -->
          <tr>
            <td align="center" style="padding-bottom:28px;">
              <img
                src="${LOGO_URL}"
                alt="BirthReminder"
                width="90" height="90"
                style="display:block;margin:0 auto 10px;"
              />
              <span style="font-size:20px;font-weight:700;color:#ffffff;letter-spacing:-0.3px;">
                BirthReminder
              </span>
            </td>
          </tr>

          <!-- CARD -->
          <tr>
            <td style="
              background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);
              border-radius:16px;
              overflow:hidden;
              box-shadow:0 10px 40px rgba(0,0,0,0.4);
            ">
              <table width="100%" cellpadding="0" cellspacing="0">
  `;
}

/**
 * Génère le footer commun à tous les emails
 * @param {string} unsubscribeHtml - HTML optionnel des liens de désabonnement
 */
function emailFooter(unsubscribeHtml = "") {
  return `
              </table>
            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td align="center" style="padding-top:24px;">
              ${unsubscribeHtml}
              <p style="margin:8px 0 0;font-size:12px;color:#6b7280;line-height:1.6;">
                © ${YEAR} BirthReminder · Fait avec ❤️ par Joss Filippi
              </p>
              <p style="margin:4px 0 0;font-size:11px;color:#4b5563;">
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
}

/**
 * Badge coloré en haut de la carte
 */
function badge(text) {
  return `
                <tr>
                  <td align="center" style="padding:28px 40px 16px;">
                    <div style="
                      display:inline-block;
                      background-color:rgba(255,255,255,0.2);
                      padding:7px 20px;
                      border-radius:20px;
                    ">
                      <span style="font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:1px;color:#ffffff;">
                        ${text}
                      </span>
                    </div>
                  </td>
                </tr>
  `;
}

/**
 * Icône ronde
 */
function icon(emoji) {
  return `
                <tr>
                  <td align="center" style="padding:28px 40px 8px;">
                    <div style="
                      width:60px;height:60px;
                      background-color:rgba(255,255,255,0.2);
                      border-radius:50%;
                      -webkit-border-radius:50%;
                      text-align:center;
                      font-size:28px;
                      line-height:60px;
                      margin:0 auto;
                    ">${emoji}</div>
                  </td>
                </tr>
  `;
}

/**
 * Titre principal
 */
function title(text) {
  return `
                <tr>
                  <td align="center" style="padding:12px 40px 8px;">
                    <h1 style="margin:0;font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.3px;">
                      ${text}
                    </h1>
                  </td>
                </tr>
  `;
}

/**
 * Paragraphe de texte
 */
function paragraph(html) {
  return `
                <tr>
                  <td align="center" style="padding:8px 40px 16px;">
                    <p style="margin:0;font-size:16px;line-height:1.7;color:rgba(255,255,255,0.9);max-width:400px;">
                      ${html}
                    </p>
                  </td>
                </tr>
  `;
}

/**
 * Bouton CTA principal
 */
function ctaButton(url, label) {
  return `
                <tr>
                  <td align="center" style="padding:16px 40px 32px;">
                    <a href="${url}" style="
                      display:inline-block;
                      background-color:#ffffff;
                      color:#667eea;
                      text-decoration:none;
                      font-size:15px;
                      font-weight:700;
                      padding:14px 40px;
                      border-radius:10px;
                      box-shadow:0 4px 15px rgba(0,0,0,0.2);
                    ">${label} →</a>
                  </td>
                </tr>
  `;
}

/**
 * Note secondaire sous le bouton
 */
function note(html) {
  return `
                <tr>
                  <td align="center" style="padding:0 40px 28px;">
                    <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.55);line-height:1.6;">
                      ${html}
                    </p>
                  </td>
                </tr>
  `;
}

/**
 * Séparateur + lien texte (pour reset password)
 */
function linkFallback(url) {
  return `
                <tr>
                  <td style="border-top:1px solid rgba(255,255,255,0.15);padding:20px 40px 8px;">
                    <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.5);text-align:center;">
                      Si le bouton ne fonctionne pas, copiez ce lien :
                    </p>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding:4px 40px 20px;">
                    <a href="${url}" style="font-size:12px;color:rgba(255,255,255,0.7);word-break:break-all;text-decoration:none;">${url}</a>
                  </td>
                </tr>
  `;
}

/**
 * Bloc avertissement jaune
 */
function warning(html) {
  return `
                <tr>
                  <td style="padding:0 32px 28px;">
                    <div style="
                      background:rgba(254,249,195,0.15);
                      border:1px solid rgba(253,224,71,0.4);
                      border-radius:10px;
                      padding:12px 16px;
                    ">
                      <p style="margin:0;font-size:12px;color:rgba(255,249,195,0.9);line-height:1.5;text-align:center;">
                        ${html}
                      </p>
                    </div>
                  </td>
                </tr>
  `;
}

module.exports = {
  emailHeader,
  emailFooter,
  badge,
  icon,
  title,
  paragraph,
  ctaButton,
  note,
  linkFallback,
  warning,
};
