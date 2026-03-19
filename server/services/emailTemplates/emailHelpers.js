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

/**
 * Ligne d'avatar avec initiales colorées, nom cliquable et badge J-X
 * Utilisé dans le récap mensuel
 * @param {string} name
 * @param {string} surname
 * @param {string} dateLabel  - ex: "Samedi 6 avril · dans 3 jours"
 * @param {string} badgeText  - ex: "J-3" | "Aujourd'hui" | "Passé"
 * @param {boolean} urgent    - true = badge violet, false = badge gris
 * @param {string} profileUrl - URL de destination du lien nom
 */
function avatarBlock(name, surname, dateLabel, badgeText, urgent, profileUrl) {
  const colors = [
    { bg: "#CECBF6", text: "#3C3489" }, // purple
    { bg: "#9FE1CB", text: "#085041" }, // teal
    { bg: "#F5C4B3", text: "#712B13" }, // coral
    { bg: "#B5D4F4", text: "#0C447C" }, // blue
    { bg: "#C0DD97", text: "#27500A" }, // green
    { bg: "#FAC775", text: "#633806" }, // amber
    { bg: "#F4C0D1", text: "#72243E" }, // pink
  ];
  // Couleur persistante basée sur la première lettre du prénom
  const idx = (name.charCodeAt(0) || 0) % colors.length;
  const color = colors[idx];
  const initials = `${name[0] || ""}${surname[0] || ""}`.toUpperCase();

  const badgeBg = urgent ? "#EEEDFE" : "rgba(255,255,255,0.15)";
  const badgeColor = urgent ? "#534AB7" : "rgba(255,255,255,0.7)";

  return `
                <tr>
                  <td style="padding:0 32px;">
                    <table width="100%" cellpadding="0" cellspacing="0"
                      style="border-bottom:1px solid rgba(255,255,255,0.1);">
                      <tr>
                        <!-- Avatar initiales -->
                        <td width="44" valign="middle" style="padding:12px 0;">
                          <div style="
                            width:40px;height:40px;
                            border-radius:50%;
                            background-color:${color.bg};
                            text-align:center;
                            line-height:40px;
                            font-size:13px;
                            font-weight:700;
                            color:${color.text};
                            font-family:'Roboto',Arial,sans-serif;
                          ">${initials}</div>
                        </td>
                        <!-- Nom + date -->
                        <td valign="middle" style="padding:12px 0 12px 12px;">
                          <a href="${profileUrl}" style="
                            font-size:14px;font-weight:700;
                            color:#ffffff;text-decoration:none;
                            display:block;margin-bottom:2px;
                          ">${name} ${surname}</a>
                          <span style="font-size:12px;color:rgba(255,255,255,0.55);">
                            ${dateLabel}
                          </span>
                        </td>
                        <!-- Badge J-X -->
                        <td width="52" align="right" valign="middle" style="padding:12px 0;">
                          <span style="
                            display:inline-block;
                            background:${badgeBg};
                            color:${badgeColor};
                            font-size:11px;font-weight:700;
                            padding:3px 8px;
                            border-radius:20px;
                            white-space:nowrap;
                          ">${badgeText}</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
  `;
}

/**
 * Titre de section en majuscules (ex: "CETTE SEMAINE")
 * Utilisé dans le récap mensuel
 */
function sectionLabel(text) {
  return `
                <tr>
                  <td style="padding:20px 32px 8px;">
                    <p style="
                      margin:0;
                      font-size:11px;font-weight:700;
                      letter-spacing:0.08em;
                      text-transform:uppercase;
                      color:rgba(255,255,255,0.4);
                    ">${text}</p>
                  </td>
                </tr>
  `;
}

/**
 * Ligne de métriques (3 chiffres côte à côte)
 * Utilisé dans le récap mensuel
 * @param {Array<{value: number|string, label: string}>} metrics
 */
function metricRow(metrics) {
  const cells = metrics
    .map(
      ({ value, label }) => `
        <td align="center" style="padding:16px 8px;">
          <p style="margin:0;font-size:26px;font-weight:700;color:#ffffff;">
            ${value}
          </p>
          <p style="margin:4px 0 0;font-size:11px;color:rgba(255,255,255,0.55);">
            ${label}
          </p>
        </td>
      `,
    )
    .join(
      `<td width="1" style="background:rgba(255,255,255,0.1);padding:0;"></td>`,
    );

  return `
                <tr>
                  <td style="padding:0 32px 8px;">
                    <table width="100%" cellpadding="0" cellspacing="0" style="
                      background:rgba(255,255,255,0.08);
                      border-radius:12px;
                      overflow:hidden;
                    ">
                      <tr>${cells}</tr>
                    </table>
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
  avatarBlock,
  sectionLabel,
  metricRow,
};
