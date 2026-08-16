const { SESClient, SendEmailCommand } = require("@aws-sdk/client-ses");
const { emailHeader, emailFooter, badge, title, paragraph, ctaButton, note } = require("./emailHelpers");

const sesClient = new SESClient({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const sendEventEmail = async (recipientEmail, subject, contentOptions) => {
  // `footnote` : ligne discrète sous le bouton. Ajoutée pour les invités
  // externes, qui n'ont pas de compte et ont besoin du code d'accès pour
  // rouvrir l'événement depuis un autre appareil que celui où ils l'ont
  // rejoint (leur guestToken vit dans le localStorage de ce navigateur-là).
  // Optionnel : tous les appels existants restent inchangés.
  const html =
    emailHeader() +
    (contentOptions.badge ? badge(contentOptions.badge) : "") +
    title(contentOptions.title) +
    paragraph(contentOptions.message) +
    (contentOptions.ctaLink ? ctaButton(contentOptions.ctaLink, contentOptions.ctaText) : "") +
    (contentOptions.footnote ? note(contentOptions.footnote) : "") +
    emailFooter();

  const params = {
    Source: `BirthReminder Events <${process.env.EMAIL_BRTHDAY}>`,
    Destination: { ToAddresses: [recipientEmail] },
    Message: {
      Subject: { Data: subject, Charset: "UTF-8" },
      Body: {
        Html: { Data: html, Charset: "UTF-8" },
        Text: {
          Data: [
            contentOptions.title,
            "",
            // La version texte ne doit pas afficher les balises du HTML.
            String(contentOptions.message).replace(/<[^>]+>/g, ""),
            "",
            contentOptions.ctaLink || "",
            contentOptions.footnote
              ? `\n${String(contentOptions.footnote).replace(/<[^>]+>/g, "")}`
              : "",
          ].join("\n"),
          Charset: "UTF-8",
        },
      },
    },
  };

  try {
    await sesClient.send(new SendEmailCommand(params));
    console.log(`✅ Email d'événement envoyé à ${recipientEmail} : ${subject}`);
    return { success: true };
  } catch (error) {
    console.error("❌ Erreur envoi email d'événement:", error);
    return { success: false, error: error.message };
  }
};

const sendEventInvitationEmail = (email, event, userName, url) => {
  return sendEventEmail(email, `Tu es invité(e) à ${event.title} 🎉`, {
    badge: "Invitation",
    title: `Tu es invité(e) à ${event.title} !`,
    message: `<strong>${userName}</strong> t'a invité à participer à l'événement "${event.title}". Réponds vite pour confirmer ta présence !`,
    ctaLink: url,
    ctaText: "Voir l'événement",
  });
};

const sendEventReminderEmail = (email, event, daysLeft, url) => {
  const isTomorrow = daysLeft === 1;
  const subject = isTomorrow ? `C'est demain : ${event.title} ⏳` : `L'événement ${event.title} approche ! 📅`;
  const msg = isTomorrow 
    ? `Prépare-toi, l'événement "${event.title}" a lieu demain !`
    : `L'événement "${event.title}" aura lieu dans ${daysLeft} jours. Ce petit rappel pour être sûr que tu sois prêt(e) !`;
    
  return sendEventEmail(email, subject, {
    badge: "Rappel",
    title: subject,
    message: msg,
    ctaLink: url,
    ctaText: "Détails de l'événement",
  });
};

const sendEventVoteRequestEmail = (email, event, type, url) => {
  return sendEventEmail(email, `L'organisateur a besoin de ton vote pour ${event.title} 🗳️`, {
    badge: "Vote",
    title: "On a besoin de ton avis",
    message: `L'organisateur de l'événement "${event.title}" a besoin de tes votes pour définir ${type === 'date' ? 'la date' : 'le lieu'}. Connecte-toi vite pour participer !`,
    ctaLink: url,
    ctaText: "Voter maintenant",
  });
};

const sendEventDateConfirmedEmail = (email, event, dateStr, url) => {
  return sendEventEmail(email, `La date de ${event.title} est confirmée ! 🗓️`, {
    badge: "Approuvé",
    title: "Date confirmée",
    message: `La date pour l'événement "${event.title}" a été définitivement arrêtée au <strong>${dateStr}</strong>. Bloque cette date dans ton calendrier !`,
    ctaLink: url,
    ctaText: "Voir l'événement",
  });
};

/**
 * La date de l'événement a changé → l'invité doit reconfirmer sa présence.
 *
 * Destiné aux invités EXTERNES (pas de compte, donc ni notification in-app ni
 * push) : sans cet email, leur RSVP est réinitialisé côté serveur sans qu'ils
 * en soient jamais informés — l'organisateur les verrait passer en "en attente"
 * sans qu'ils aient rien fait.
 *
 * Le code d'accès est inclus : sans lui, un invité qui ouvre le lien depuis un
 * autre appareil que celui où il a rejoint l'événement retombe en lecture seule
 * (son guestToken vit dans le localStorage de l'autre navigateur) et ne peut
 * donc pas faire ce que l'email lui demande — reconfirmer sa présence.
 *
 * @param {string} email      destinataire
 * @param {Object} event      document Event (title, shortId)
 * @param {string} dateStr    nouvelle date déjà formatée en français
 * @param {string} url        lien public vers l'événement
 * @param {string|null} accessCode  code d'accès, si l'événement en a un
 */
const sendEventDateChangedEmail = (email, event, dateStr, url, accessCode) => {
  return sendEventEmail(email, `Nouvelle date pour ${event.title} — confirme ta présence 📅`, {
    badge: "Date modifiée",
    title: "La date a changé",
    message: `L'organisateur a déplacé l'événement "${event.title}". Nouvelle date : <strong>${dateStr}</strong>.<br><br>Ta réponse précédente a été remise à zéro : merci de <strong>reconfirmer ta présence</strong> pour cette nouvelle date.`,
    ctaLink: url,
    ctaText: "Confirmer ma présence",
    footnote: accessCode
      ? `Si l'événement te demande un code d'accès, utilise : <strong>${accessCode}</strong>`
      : null,
  });
};

module.exports = {
  sendEventInvitationEmail,
  sendEventReminderEmail,
  sendEventVoteRequestEmail,
  sendEventDateConfirmedEmail,
  sendEventDateChangedEmail,
};
