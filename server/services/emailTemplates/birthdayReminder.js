// Template HTML pour les emails de rappel d'anniversaire
// Ce fichier génère le contenu HTML et texte des emails

/**
 * Génère le template HTML de l'email de rappel d'anniversaire
 * @param {Object} params - Les paramètres du template
 * @param {string} params.name - Le prénom de la personne
 * @param {string} params.surname - Le nom de famille de la personne
 * @param {number} params.daysBeforeBirthday - Nombre de jours avant l'anniversaire (0 = aujourd'hui)
 * @param {string} params.birthdayLink - Lien vers la page de l'anniversaire
 * @param {string} params.unsubscribeAllLink - Lien pour se désabonner de tous les rappels
 * @param {string} params.unsubscribeSpecificLink - Lien pour se désabonner de cet anniversaire uniquement
 * @returns {string} Le code HTML de l'email
 */
const getBirthdayReminderTemplate = ({
  name,
  surname,
  daysBeforeBirthday,
  birthdayLink,
  unsubscribeAllLink,
  unsubscribeSpecificLink,
}) => {
  // Définir le message selon le délai
  let greeting, message, ctaText;

  if (daysBeforeBirthday === 0) {
    greeting = "C'est aujourd'hui ! 🎉";
    message = `L'anniversaire de <strong>${name} ${surname}</strong> est aujourd'hui !`;
    ctaText = "Voir le Profil";
  } else if (daysBeforeBirthday === 1) {
    greeting = "C'est demain ! 🎂";
    message = `L'anniversaire de <strong>${name} ${surname}</strong> est demain !`;
    ctaText = "Voir le Profil";
  } else {
    greeting = `Dans ${daysBeforeBirthday} jours 📅`;
    message = `L'anniversaire de <strong>${name} ${surname}</strong> arrive dans ${daysBeforeBirthday} jours !`;
    ctaText = "Voir le Profil";
  }

  // Retourner le template HTML complet
  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Rappel d'anniversaire</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #1a1a2e; color: #ffffff;">
  
  <!-- Container principal avec fond sombre -->
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #1a1a2e;">
    <tr>
      <td style="padding: 40px 20px;">
        
        <!-- Carte de l'email avec gradient -->
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 16px; overflow: hidden; box-shadow: 0 10px 40px rgba(0,0,0,0.3);">
          
          <!-- Header avec logo BirthReminder -->
          <tr>
            <td style="padding: 40px 40px 20px 40px; text-align: center;">
              <h1 style="margin: 0; font-size: 32px; font-weight: 700; letter-spacing: -0.5px;">
                🎉 BirthReminder
              </h1>
            </td>
          </tr>
          
          <!-- Badge de timing (aujourd'hui, demain, X jours) -->
          <tr>
            <td style="padding: 0 40px 20px 40px; text-align: center;">
              <div style="display: inline-block; background-color: rgba(255,255,255,0.2); padding: 8px 20px; border-radius: 20px; backdrop-filter: blur(10px);">
                <span style="font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">
                  ${greeting}
                </span>
              </div>
            </td>
          </tr>
          
          <!-- Message principal -->
          <tr>
            <td style="padding: 0 40px 30px 40px; text-align: center;">
              <p style="margin: 0; font-size: 18px; line-height: 1.6; color: rgba(255,255,255,0.95);">
                ${message}
              </p>
            </td>
          </tr>
          
          <!-- Bouton CTA pour accéder à la page de l'anniversaire -->
          <tr>
            <td style="padding: 0 40px 40px 40px; text-align: center;">
              <a href="${birthdayLink}" style="display: inline-block; background-color: #ffffff; color: #667eea; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 15px rgba(0,0,0,0.2); transition: transform 0.2s;">
                ${ctaText} →
              </a>
            </td>
          </tr>
          
        </table>
        
        <!-- Footer avec options de désabonnement -->
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 600px; margin: 20px auto 0 auto;">
          <tr>
            <td style="padding: 20px; text-align: center; font-size: 12px; color: #888; line-height: 1.6;">
              <p style="margin: 0 0 10px 0;">Options de notification :</p>
              <p style="margin: 0 0 5px 0;">
                <a href="${unsubscribeSpecificLink}" style="color: #667eea; text-decoration: none;">
                  Ne plus recevoir de notifications pour ${name} ${surname}
                </a>
              </p>
              <p style="margin: 0;">
                <a href="${unsubscribeAllLink}" style="color: #667eea; text-decoration: none;">
                  Se désabonner de tous les rappels
                </a>
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
};

/**
 * Génère la version texte brut de l'email (pour les clients email qui ne supportent pas HTML)
 * @param {Object} params - Les mêmes paramètres que la version HTML
 * @returns {string} Le contenu texte brut de l'email
 */
const getBirthdayReminderTextVersion = ({
  name,
  surname,
  daysBeforeBirthday,
  birthdayLink,
  unsubscribeAllLink,
  unsubscribeSpecificLink,
}) => {
  let message;

  if (daysBeforeBirthday === 0) {
    message = `C'est aujourd'hui l'anniversaire de ${name} ${surname} !`;
  } else if (daysBeforeBirthday === 1) {
    message = `L'anniversaire de ${name} ${surname} est demain !`;
  } else {
    message = `L'anniversaire de ${name} ${surname} arrive dans ${daysBeforeBirthday} jours !`;
  }

  return `
${message}

Voir les détails : ${birthdayLink}

---
Options de notification :
- Ne plus recevoir de notifications pour ${name} ${surname} : ${unsubscribeSpecificLink}
- Se désabonner de tous les rappels : ${unsubscribeAllLink}
  `.trim();
};

// Export des deux fonctions
module.exports = {
  getBirthdayReminderTemplate,
  getBirthdayReminderTextVersion,
};
