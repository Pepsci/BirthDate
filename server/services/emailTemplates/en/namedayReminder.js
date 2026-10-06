// Version anglaise de ../namedayReminder.js : mêmes fonctions, mêmes paramètres.
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

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function getNamedayReminderTemplate({
  name,
  surname,
  daysBeforeNameday,
  namedayLink,
  appLink,
  unsubscribeAllLink,
  unsubscribeSpecificLink,
  formattedDate,
}) {
  const who = fullNameOf(name, surname);
  let badgeText, titleText, mainText;

  if (daysBeforeNameday === 0) {
    badgeText = "Today 🎉";
    titleText = "It's their name day!";
    mainText = `Today is <strong>${who}</strong>'s name day! Do not forget to wish them well! ✨`;
  } else if (daysBeforeNameday === 1) {
    badgeText = "Tomorrow 🌸";
    titleText = "Name day tomorrow";
    mainText = `<strong>${who}</strong>'s name day is <strong>tomorrow</strong> (${formattedDate})!`;
  } else {
    badgeText = `In ${daysBeforeNameday} days 📅`;
    titleText = `Name day in ${daysBeforeNameday} days`;
    mainText = `<strong>${who}</strong>'s name day is in <strong>${daysBeforeNameday} days</strong> (${formattedDate})!`;
  }

  return (
    emailHeader() +
    badge(badgeText) +
    title(titleText) +
    paragraph(mainText) +
    ctaButtonWithApp(namedayLink, "View profile", appLink) +
    emailFooter(`
      <p style="margin:0 0 4px;font-size:12px;color:#6b7280;">
        <a href="${unsubscribeSpecificLink}" style="color:#818cf8;text-decoration:none;">
          Stop receiving reminders for ${name}
        </a>
      </p>
      <p style="margin:0 0 8px;font-size:12px;color:#6b7280;">
        <a href="${unsubscribeAllLink}" style="color:#6b7280;text-decoration:none;">
          Stop receiving birthday reminders
        </a>
      </p>
    `)
  );
}

function getNamedayReminderTextVersion({
  name,
  surname,
  daysBeforeNameday,
  namedayLink,
  appLink,
  unsubscribeAllLink,
  unsubscribeSpecificLink,
  formattedDate,
}) {
  const who = fullNameOf(name, surname);
  let mainText;
  if (daysBeforeNameday === 0) {
    mainText = `Today is ${who}'s name day!`;
  } else if (daysBeforeNameday === 1) {
    mainText = `${who}'s name day is tomorrow (${formattedDate})!`;
  } else {
    mainText = `${who}'s name day is in ${daysBeforeNameday} days (${formattedDate})!`;
  }
  const appLine = appLink ? `\nOpen in the app: ${appLink}` : "";
  return `${mainText}\n\nView profile: ${namedayLink}${appLine}\n\n---\nStop receiving reminders for ${name}: ${unsubscribeSpecificLink}\nStop receiving birthday reminders: ${unsubscribeAllLink}`;
}

async function sendNamedayReminderEmail(date, daysBeforeNameday) {
  try {
    const owner = date.owner;
    if (!owner || !owner.email) return;

    const frontendUrl = process.env.FRONTEND_URL || "https://birthreminder.com";
    const name = date.name || date.linkedUser?.name || "";
    const surname = date.surname || date.linkedUser?.surname || "";
    const who = fullNameOf(name, surname);

    const [month, day] = date.nameday.split("-");
    const formattedDate = `${parseInt(day)} ${MONTH_NAMES[parseInt(month) - 1]}`;

    const namedayLink = `${frontendUrl}/home?tab=date&dateId=${date._id}`;
    const appLink = appLinkFor(owner, namedayLink);
    const unsubscribeAllLink = `${frontendUrl}/unsubscribe?userId=${owner._id}&type=all`;
    const unsubscribeSpecificLink = `${frontendUrl}/unsubscribe?userId=${owner._id}&dateId=${date._id}&type=specific`;

    const subject =
      daysBeforeNameday === 0
        ? `✨ It's ${who}'s name day today!`
        : daysBeforeNameday === 1
          ? `✨ ${who}'s name day is tomorrow!`
          : `✨ ${who}'s name day in ${daysBeforeNameday} days`;

    const args = {
      name,
      surname,
      daysBeforeNameday,
      namedayLink,
      appLink,
      unsubscribeAllLink,
      unsubscribeSpecificLink,
      formattedDate,
    };

    const params = {
      Source: `BirthReminder <${process.env.EMAIL_BRTHDAY}>`,
      Destination: { ToAddresses: [owner.email] },
      Message: {
        Subject: { Data: subject, Charset: "UTF-8" },
        Body: {
          Html: { Data: getNamedayReminderTemplate(args), Charset: "UTF-8" },
          Text: { Data: getNamedayReminderTextVersion(args), Charset: "UTF-8" },
        },
      },
    };

    await sesClient.send(new SendEmailCommand(params));
    console.log(
      `✅ Email fête (en) J-${daysBeforeNameday} envoyé à ${owner.email} pour ${who}`,
    );
  } catch (error) {
    console.error(`❌ Erreur envoi email fête (en) à ${date.owner?.email}:`, error);
  }
}

module.exports = {
  getNamedayReminderTemplate,
  getNamedayReminderTextVersion,
  sendNamedayReminderEmail,
};
