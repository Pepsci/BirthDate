// Version anglaise de ../birthdayReminder.js : mêmes fonctions, mêmes paramètres.
const { SESClient, SendEmailCommand } = require("@aws-sdk/client-ses");
const {
  emailHeader,
  emailFooter,
  badge,
  title,
  paragraph,
  ctaButtonWithApp,
} = require("./emailHelpers");
const { appLinkFor } = require("../../../utils/mobileLinks");

const fullNameOf = (name, surname) =>
  [name, surname].filter((part) => !!String(part ?? "").trim()).join(" ");

const sesClient = new SESClient({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const getBirthdayReminderTemplate = ({
  name,
  surname,
  daysBeforeBirthday,
  birthdayLink,
  appLink,
  unsubscribeAllLink,
  unsubscribeSpecificLink,
}) => {
  const who = fullNameOf(name, surname);
  let badgeText, titleText, message;

  if (daysBeforeBirthday === 0) {
    badgeText = "Today 🎉";
    titleText = "It's their birthday!";
    message = `<strong>${who}</strong>'s birthday is <strong>today</strong>! Do not forget to wish them a happy birthday! 🎂`;
  } else if (daysBeforeBirthday === 1) {
    badgeText = "Tomorrow 🎂";
    titleText = "Birthday tomorrow";
    message = `<strong>${who}</strong>'s birthday is <strong>tomorrow</strong>! Get your wishes ready!`;
  } else {
    badgeText = `In ${daysBeforeBirthday} days 📅`;
    titleText = `Birthday in ${daysBeforeBirthday} days`;
    message = `<strong>${who}</strong>'s birthday is in <strong>${daysBeforeBirthday} days</strong>. Keep them in mind!`;
  }

  return (
    emailHeader() +
    badge(badgeText) +
    title(titleText) +
    paragraph(message) +
    ctaButtonWithApp(birthdayLink, "View profile", appLink) +
    emailFooter(`
      <p style="margin:0 0 4px;font-size:12px;color:#6b7280;">
        <a href="${unsubscribeSpecificLink}" style="color:#818cf8;text-decoration:none;">
          Stop receiving reminders for ${who}
        </a>
      </p>
      <p style="margin:0 0 8px;font-size:12px;color:#6b7280;">
        <a href="${unsubscribeAllLink}" style="color:#6b7280;text-decoration:none;">
          Unsubscribe from all reminders
        </a>
      </p>
    `)
  );
};

const getBirthdayReminderTextVersion = ({
  name,
  surname,
  daysBeforeBirthday,
  birthdayLink,
  appLink,
  unsubscribeAllLink,
  unsubscribeSpecificLink,
}) => {
  const who = fullNameOf(name, surname);
  let message;
  if (daysBeforeBirthday === 0) {
    message = `It's ${who}'s birthday today!`;
  } else if (daysBeforeBirthday === 1) {
    message = `${who}'s birthday is tomorrow!`;
  } else {
    message = `${who}'s birthday is in ${daysBeforeBirthday} days!`;
  }
  const appLine = appLink ? `\nOpen in the app: ${appLink}` : "";
  return `${message}\n\nView profile: ${birthdayLink}${appLine}\n\n---\nStop receiving reminders for ${name}: ${unsubscribeSpecificLink}\nUnsubscribe from all reminders: ${unsubscribeAllLink}`;
};

async function sendBirthdayReminderEmail(owner, date, daysBeforeBirthday) {
  try {
    const frontendUrl = process.env.FRONTEND_URL || "https://birthreminder.com";

    const name = date ? date.name || date.linkedUser?.name || "" : owner.name;
    const surname = date
      ? date.surname || date.linkedUser?.surname || ""
      : owner.surname || "";
    const who = fullNameOf(name, surname);
    const dateId = date ? date._id : null;

    const birthdayLink = dateId
      ? `${frontendUrl}/home?tab=date&dateId=${dateId}`
      : `${frontendUrl}/home`;

    const appLink = appLinkFor(owner, birthdayLink);

    const unsubscribeAllLink = `${frontendUrl}/unsubscribe?userId=${owner._id}&type=all`;
    const unsubscribeSpecificLink = dateId
      ? `${frontendUrl}/unsubscribe?userId=${owner._id}&dateId=${dateId}&type=specific`
      : unsubscribeAllLink;

    const subject =
      daysBeforeBirthday === 0
        ? `🎂 It's ${who}'s birthday today!`
        : daysBeforeBirthday === 1
          ? `🎂 ${who}'s birthday is tomorrow!`
          : `🎂 ${who}'s birthday in ${daysBeforeBirthday} days`;

    const args = {
      name,
      surname,
      daysBeforeBirthday,
      birthdayLink,
      appLink,
      unsubscribeAllLink,
      unsubscribeSpecificLink,
    };

    const params = {
      Source: `BirthReminder <${process.env.EMAIL_BRTHDAY}>`,
      Destination: { ToAddresses: [owner.email] },
      Message: {
        Subject: { Data: subject, Charset: "UTF-8" },
        Body: {
          Html: { Data: getBirthdayReminderTemplate(args), Charset: "UTF-8" },
          Text: { Data: getBirthdayReminderTextVersion(args), Charset: "UTF-8" },
        },
      },
    };

    await sesClient.send(new SendEmailCommand(params));
    console.log(
      `✅ Email anniversaire (en) J-${daysBeforeBirthday} envoyé à ${owner.email} pour ${who}`,
    );
  } catch (error) {
    console.error(
      `❌ Erreur envoi email anniversaire (en) à ${owner.email}:`,
      error,
    );
  }
}

module.exports = {
  getBirthdayReminderTemplate,
  getBirthdayReminderTextVersion,
  sendBirthdayReminderEmail,
};
