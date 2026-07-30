const { SESClient, SendEmailCommand } = require("@aws-sdk/client-ses");
const {
  emailHeader,
  emailFooter,
  badge,
  title,
  paragraph,
  ctaButtonWithApp,
} = require("./emailHelpers");
const { appLinkFor } = require("../../utils/mobileLinks");

/**
 * "Léa Martin" · "Léa" si le nom de famille n'a pas été saisi (il est
 * optionnel sur une carte, contrairement au prénom).
 */
const fullNameOf = (name, surname) =>
  [name, surname].filter((part) => !!String(part ?? "").trim()).join(" ");

const sesClient = new SESClient({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

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
    badgeText = "Aujourd'hui 🎉";
    titleText = "C'est sa fête !";
    mainText = `C'est aujourd'hui la fête de <strong>${who}</strong> ! N'oubliez pas de lui souhaiter ! ✨`;
  } else if (daysBeforeNameday === 1) {
    badgeText = "Demain 🌸";
    titleText = "Fête demain";
    mainText = `La fête de <strong>${who}</strong> est <strong>demain</strong> (${formattedDate}) !`;
  } else {
    badgeText = `Dans ${daysBeforeNameday} jours 📅`;
    titleText = `Fête dans ${daysBeforeNameday} jours`;
    mainText = `La fête de <strong>${who}</strong> est dans <strong>${daysBeforeNameday} jours</strong> (${formattedDate}) !`;
  }

  return (
    emailHeader() +
    badge(badgeText) +
    title(titleText) +
    paragraph(mainText) +
    ctaButtonWithApp(namedayLink, "Voir le profil", appLink) +
    emailFooter(`
      <p style="margin:0 0 4px;font-size:12px;color:#6b7280;">
        <a href="${unsubscribeSpecificLink}" style="color:#818cf8;text-decoration:none;">
          Ne plus recevoir de rappels pour ${name}
        </a>
      </p>
      <p style="margin:0 0 8px;font-size:12px;color:#6b7280;">
        <a href="${unsubscribeAllLink}" style="color:#6b7280;text-decoration:none;">
          Ne plus recevoir de rappels d'anniversaires
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
    mainText = `C'est aujourd'hui la fête de ${who} !`;
  } else if (daysBeforeNameday === 1) {
    mainText = `La fête de ${who} est demain (${formattedDate}) !`;
  } else {
    mainText = `La fête de ${who} est dans ${daysBeforeNameday} jours (${formattedDate}) !`;
  }
  const appLine = appLink ? `\nOuvrir dans l'application : ${appLink}` : "";
  return `${mainText}\n\nVoir le profil : ${namedayLink}${appLine}\n\n---\nNe plus recevoir de rappels pour ${name} : ${unsubscribeSpecificLink}\nNe plus recevoir de rappels d'anniversaires : ${unsubscribeAllLink}`;
}

async function sendNamedayReminderEmail(date, daysBeforeNameday) {
  try {
    const owner = date.owner;
    if (!owner || !owner.email) return;

    const frontendUrl = process.env.FRONTEND_URL || "https://birthreminder.com";
    // Carte sans nom propre → on retombe sur l'ami lié. Le nom de famille est
    // optionnel : fullNameOf() évite les "undefined" dans le sujet et le corps.
    const name = date.name || date.linkedUser?.name || "";
    const surname = date.surname || date.linkedUser?.surname || "";
    const who = fullNameOf(name, surname);

    const [month, day] = date.nameday.split("-");
    const monthNames = [
      "janvier",
      "février",
      "mars",
      "avril",
      "mai",
      "juin",
      "juillet",
      "août",
      "septembre",
      "octobre",
      "novembre",
      "décembre",
    ];
    const formattedDate = `${parseInt(day)} ${monthNames[parseInt(month) - 1]}`;

    // CORRIGÉ : deep link vers /home?tab=date&dateId= au lieu de /birthday/:id
    const namedayLink = `${frontendUrl}/home?tab=date&dateId=${date._id}`;
    // Lien app pour les comptes ayant un appareil mobile enregistré (null sinon)
    const appLink = appLinkFor(owner, namedayLink);
    const unsubscribeAllLink = `${frontendUrl}/unsubscribe?userId=${owner._id}&type=all`;
    const unsubscribeSpecificLink = `${frontendUrl}/unsubscribe?userId=${owner._id}&dateId=${date._id}&type=specific`;

    const subject =
      daysBeforeNameday === 0
        ? `✨ C'est la fête de ${who} aujourd'hui !`
        : daysBeforeNameday === 1
          ? `✨ Fête de ${who} demain !`
          : `✨ Fête de ${who} dans ${daysBeforeNameday} jours`;

    const html = getNamedayReminderTemplate({
      name,
      surname,
      daysBeforeNameday,
      namedayLink,
      appLink,
      unsubscribeAllLink,
      unsubscribeSpecificLink,
      formattedDate,
    });

    const text = getNamedayReminderTextVersion({
      name,
      surname,
      daysBeforeNameday,
      namedayLink,
      appLink,
      unsubscribeAllLink,
      unsubscribeSpecificLink,
      formattedDate,
    });

    const params = {
      Source: `BirthReminder <${process.env.EMAIL_BRTHDAY}>`,
      Destination: { ToAddresses: [owner.email] },
      Message: {
        Subject: { Data: subject, Charset: "UTF-8" },
        Body: {
          Html: { Data: html, Charset: "UTF-8" },
          Text: { Data: text, Charset: "UTF-8" },
        },
      },
    };

    await sesClient.send(new SendEmailCommand(params));
    console.log(
      `✅ Email fête J-${daysBeforeNameday} envoyé à ${owner.email} pour ${who}`,
    );
  } catch (error) {
    console.error(`❌ Erreur envoi email fête à ${date.owner?.email}:`, error);
  }
}

module.exports = {
  getNamedayReminderTemplate,
  getNamedayReminderTextVersion,
  sendNamedayReminderEmail,
};
