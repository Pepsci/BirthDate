// Version anglaise de ../eventEmails.js : mêmes fonctions, mêmes paramètres.
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
    console.log(`✅ Email d'événement (en) envoyé à ${recipientEmail} : ${subject}`);
    return { success: true };
  } catch (error) {
    console.error("❌ Erreur envoi email d'événement (en):", error);
    return { success: false, error: error.message };
  }
};

const sendEventInvitationEmail = (email, event, userName, url) => {
  return sendEventEmail(email, `You are invited to ${event.title} 🎉`, {
    badge: "Invitation",
    title: `You are invited to ${event.title}!`,
    message: `<strong>${userName}</strong> invited you to the event "${event.title}". Reply soon to say whether you are coming!`,
    ctaLink: url,
    ctaText: "View the event",
  });
};

const sendEventReminderEmail = (email, event, daysLeft, url) => {
  const isTomorrow = daysLeft === 1;
  const subject = isTomorrow ? `It's tomorrow: ${event.title} ⏳` : `${event.title} is coming up! 📅`;
  const msg = isTomorrow
    ? `Get ready, the event "${event.title}" is tomorrow!`
    : `The event "${event.title}" takes place in ${daysLeft} days. Just a little reminder to make sure you are ready!`;

  return sendEventEmail(email, subject, {
    badge: "Reminder",
    title: subject,
    message: msg,
    ctaLink: url,
    ctaText: "Event details",
  });
};

const sendEventVoteRequestEmail = (email, event, type, url) => {
  return sendEventEmail(email, `The host needs your vote for ${event.title} 🗳️`, {
    badge: "Vote",
    title: "We need your opinion",
    message: `The host of the event "${event.title}" needs your votes to settle ${type === 'date' ? 'the date' : 'the place'}. Log in to take part!`,
    ctaLink: url,
    ctaText: "Vote now",
  });
};

const sendEventDateConfirmedEmail = (email, event, dateStr, url) => {
  return sendEventEmail(email, `The date of ${event.title} is confirmed! 🗓️`, {
    badge: "Confirmed",
    title: "Date confirmed",
    message: `The date for the event "${event.title}" has been set to <strong>${dateStr}</strong>. Save this date in your calendar!`,
    ctaLink: url,
    ctaText: "View the event",
  });
};

/** @param {string} dateStr nouvelle date déjà formatée (en anglais) */
const sendEventDateChangedEmail = (email, event, dateStr, url, accessCode) => {
  return sendEventEmail(email, `New date for ${event.title}: please confirm you are coming 📅`, {
    badge: "Date changed",
    title: "The date has changed",
    message: `The host moved the event "${event.title}". New date: <strong>${dateStr}</strong>.<br><br>Your previous reply was reset: please <strong>confirm again</strong> for this new date.`,
    ctaLink: url,
    ctaText: "Confirm I am coming",
    footnote: accessCode
      ? `If the event asks for an access code, use: <strong>${accessCode}</strong>`
      : null,
  });
};

const sendEventCancelledEmail = async (
  recipientEmail,
  { event, reason, organizerName, addedToCalendar = true },
) => {
  const url = `${process.env.FRONTEND_URL}/event/${event.shortId}`;
  const why = reason
    ? `Reason given: <em>${reason}</em>`
    : `${organizerName || "The host"} did not give a reason.`;

  return sendEventEmail(
    recipientEmail,
    `❌ Cancelled: ${event.title}`,
    {
      badge: "EVENT CANCELLED",
      title: `"${event.title}" is cancelled`,
      message: `${why}<br><br>The event page stays available, but the event will not take place.`,
      ctaLink: url,
      ctaText: "View the event",
      footnote: addedToCalendar
        ? "If you added this event to your calendar, remember to remove it: BirthReminder cannot change an entry already created in your calendar."
        : null,
    },
  );
};

module.exports = {
  sendEventCancelledEmail,
  sendEventInvitationEmail,
  sendEventReminderEmail,
  sendEventVoteRequestEmail,
  sendEventDateConfirmedEmail,
  sendEventDateChangedEmail,
};
