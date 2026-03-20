const { SESClient, SendEmailCommand } = require("@aws-sdk/client-ses");
const { emailHeader, emailFooter, badge, title, paragraph, ctaButton } = require("./emailHelpers");

const sesClient = new SESClient({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const sendEventEmail = async (recipientEmail, subject, contentOptions) => {
  const html =
    emailHeader() +
    (contentOptions.badge ? badge(contentOptions.badge) : "") +
    title(contentOptions.title) +
    paragraph(contentOptions.message) +
    (contentOptions.ctaLink ? ctaButton(contentOptions.ctaLink, contentOptions.ctaText) : "") +
    emailFooter();

  const params = {
    Source: `BirthReminder Events <${process.env.EMAIL_BRTHDAY}>`,
    Destination: { ToAddresses: [recipientEmail] },
    Message: {
      Subject: { Data: subject, Charset: "UTF-8" },
      Body: {
        Html: { Data: html, Charset: "UTF-8" },
        Text: { Data: `${contentOptions.title}\n\n${contentOptions.message}\n\n${contentOptions.ctaLink || ""}`, Charset: "UTF-8" },
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

module.exports = {
  sendEventInvitationEmail,
  sendEventReminderEmail,
  sendEventVoteRequestEmail,
  sendEventDateConfirmedEmail
};
