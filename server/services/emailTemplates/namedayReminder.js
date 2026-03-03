/**
 * Template HTML et texte pour les rappels de fêtes (namedays)
 */

function getNamedayReminderTemplate({
  name,
  surname,
  daysBeforeNameday,
  namedayLink,
  unsubscribeAllLink,
  unsubscribeSpecificLink,
  formattedDate,
}) {
  let titleText, badgeText, mainText;

  if (daysBeforeNameday === 0) {
    titleText = "C'est sa fête !";
    badgeText = "Aujourd'hui";
    mainText = `C'est aujourd'hui la fête de <strong>${name} ${surname}</strong> ! 🎉`;
  } else if (daysBeforeNameday === 1) {
    titleText = "Fête demain";
    badgeText = "Demain";
    mainText = `La fête de <strong>${name} ${surname}</strong> est demain (${formattedDate}) ! 🎂`;
  } else {
    titleText = `Fête dans ${daysBeforeNameday} jours`;
    badgeText = `Dans ${daysBeforeNameday} jours`;
    mainText = `La fête de <strong>${name} ${surname}</strong> est dans ${daysBeforeNameday} jours (${formattedDate}) ! 📅`;
  }

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;background-color:#1a1a2e;color:#ffffff;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color:#1a1a2e;">
    <tr>
      <td style="padding:40px 20px;">
        
        <!-- Carte principale -->
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width:600px;margin:0 auto;background:linear-gradient(135deg,#f093fb 0%,#f5576c 100%);border-radius:16px;overflow:hidden;box-shadow:0 10px 40px rgba(0,0,0,0.3);">
          
          <!-- Header -->
          <tr>
            <td style="padding:40px 40px 20px 40px;text-align:center;">
              <h1 style="margin:0;font-size:32px;font-weight:700;color:#ffffff;">🎉 BirthReminder</h1>
            </td>
          </tr>
          
          <!-- Badge -->
          <tr>
            <td style="padding:0 40px 20px 40px;text-align:center;">
              <div style="display:inline-block;background-color:rgba(255,255,255,0.2);padding:8px 20px;border-radius:20px;">
                <span style="font-size:14px;font-weight:600;text-transform:uppercase;letter-spacing:1px;">
                  ${badgeText}
                </span>
              </div>
            </td>
          </tr>
          
          <!-- Titre principal -->
          <tr>
            <td style="padding:0 40px 20px 40px;text-align:center;">
              <h2 style="margin:0;font-size:28px;font-weight:700;color:#ffffff;">
                ${titleText}
              </h2>
            </td>
          </tr>
          
          <!-- Message principal -->
          <tr>
            <td style="padding:0 40px 30px 40px;text-align:center;">
              <p style="margin:0;font-size:18px;line-height:1.6;color:rgba(255,255,255,0.95);">
                ${mainText}
              </p>
              <p style="margin:16px 0 0 0;font-size:15px;line-height:1.6;color:rgba(255,255,255,0.85);">
                N'oubliez pas de lui souhaiter une bonne fête ! ✨
              </p>
            </td>
          </tr>
          
          <!-- CTA Button -->
          <tr>
            <td style="padding:0 40px 40px 40px;text-align:center;">
              <a href="${namedayLink}" style="display:inline-block;background-color:#ffffff;color:#f5576c;text-decoration:none;padding:16px 40px;border-radius:8px;font-weight:600;font-size:16px;box-shadow:0 4px 15px rgba(0,0,0,0.2);">
                Voir le profil →
              </a>
            </td>
          </tr>
          
        </table>
        
        <!-- Footer -->
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width:600px;margin:20px auto 0 auto;">
          <tr>
            <td style="padding:20px;text-align:center;font-size:12px;color:#888;line-height:1.8;">
              <p style="margin:0 0 8px 0;">
                <a href="${unsubscribeSpecificLink}" style="color:#f093fb;text-decoration:none;">
                  Ne plus recevoir de rappels pour ${name}
                </a>
              </p>
              <p style="margin:0;">
                <a href="${unsubscribeAllLink}" style="color:#888;text-decoration:none;">
                  Ne plus recevoir de rappels d'anniversaires
                </a>
              </p>
            </td>
          </tr>
        </table>
        
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function getNamedayReminderTextVersion({
  name,
  surname,
  daysBeforeNameday,
  namedayLink,
  unsubscribeAllLink,
  unsubscribeSpecificLink,
  formattedDate,
}) {
  let mainText;

  if (daysBeforeNameday === 0) {
    mainText = `C'est aujourd'hui la fête de ${name} ${surname} !`;
  } else if (daysBeforeNameday === 1) {
    mainText = `La fête de ${name} ${surname} est demain (${formattedDate}) !`;
  } else {
    mainText = `La fête de ${name} ${surname} est dans ${daysBeforeNameday} jours (${formattedDate}) !`;
  }

  return `
${mainText}

N'oubliez pas de lui souhaiter une bonne fête ! ✨

Voir le profil : ${namedayLink}

---
Ne plus recevoir de rappels pour ${name} : ${unsubscribeSpecificLink}
Ne plus recevoir de rappels d'anniversaires : ${unsubscribeAllLink}
`;
}

module.exports = {
  getNamedayReminderTemplate,
  getNamedayReminderTextVersion,
};
