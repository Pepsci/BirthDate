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
 * "Léa Martin" · "Léa" si le nom de famille n'a pas été saisi.
 * Le prénom est toujours renseigné sur une carte ; le nom est optionnel, d'où
 * les "undefined" qui apparaissaient avec une interpolation `${name} ${surname}`.
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
    badgeText = "Aujourd'hui 🎉";
    titleText = "C'est son anniversaire !";
    message = `L'anniversaire de <strong>${who}</strong> est <strong>aujourd'hui</strong> ! N'oubliez pas de lui souhaiter ! 🎂`;
  } else if (daysBeforeBirthday === 1) {
    badgeText = "Demain 🎂";
    titleText = "Anniversaire demain";
    message = `L'anniversaire de <strong>${who}</strong> est <strong>demain</strong> ! Préparez vos souhaits !`;
  } else {
    badgeText = `Dans ${daysBeforeBirthday} jours 📅`;
    titleText = `Anniversaire dans ${daysBeforeBirthday} jours`;
    message = `L'anniversaire de <strong>${who}</strong> arrive dans <strong>${daysBeforeBirthday} jours</strong>. Pensez à lui !`;
  }

  return (
    emailHeader() +
    badge(badgeText) +
    title(titleText) +
    paragraph(message) +
    ctaButtonWithApp(birthdayLink, "Voir le profil", appLink) +
    emailFooter(`
      <p style="margin:0 0 4px;font-size:12px;color:#6b7280;">
        <a href="${unsubscribeSpecificLink}" style="color:#818cf8;text-decoration:none;">
          Ne plus recevoir de rappels pour ${who}
        </a>
      </p>
      <p style="margin:0 0 8px;font-size:12px;color:#6b7280;">
        <a href="${unsubscribeAllLink}" style="color:#6b7280;text-decoration:none;">
          Se désabonner de tous les rappels
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
    message = `C'est aujourd'hui l'anniversaire de ${who} !`;
  } else if (daysBeforeBirthday === 1) {
    message = `L'anniversaire de ${who} est demain !`;
  } else {
    message = `L'anniversaire de ${who} arrive dans ${daysBeforeBirthday} jours !`;
  }
  const appLine = appLink ? `\nOuvrir dans l'application : ${appLink}` : "";
  return `${message}\n\nVoir le profil : ${birthdayLink}${appLine}\n\n---\nNe plus recevoir de rappels pour ${name} : ${unsubscribeSpecificLink}\nSe désabonner de tous les rappels : ${unsubscribeAllLink}`;
};

async function sendBirthdayReminderEmail(owner, date, daysBeforeBirthday) {
  try {
    const frontendUrl = process.env.FRONTEND_URL || "https://birthreminder.com";

    // Une carte peut n'avoir aucun nom propre et s'appuyer sur l'ami lié
    // (linkedUser) : on retombe dessus avant d'abandonner. Le nom de famille
    // est optionnel — fullNameOf() se charge de ne pas laisser de "undefined".
    const name = date ? date.name || date.linkedUser?.name || "" : owner.name;
    const surname = date
      ? date.surname || date.linkedUser?.surname || ""
      : owner.surname || "";
    const who = fullNameOf(name, surname);
    const dateId = date ? date._id : null;

    // CORRIGÉ : deep link vers /home?tab=date&dateId= au lieu de /birthday/:id
    const birthdayLink = dateId
      ? `${frontendUrl}/home?tab=date&dateId=${dateId}`
      : `${frontendUrl}/home`;

    // Lien app pour les comptes ayant un appareil mobile enregistré (null sinon)
    const appLink = appLinkFor(owner, birthdayLink);

    const unsubscribeAllLink = `${frontendUrl}/unsubscribe?userId=${owner._id}&type=all`;
    const unsubscribeSpecificLink = dateId
      ? `${frontendUrl}/unsubscribe?userId=${owner._id}&dateId=${dateId}&type=specific`
      : unsubscribeAllLink;

    const subject =
      daysBeforeBirthday === 0
        ? `🎂 C'est l'anniversaire de ${who} aujourd'hui !`
        : daysBeforeBirthday === 1
          ? `🎂 Anniversaire de ${who} demain !`
          : `🎂 Anniversaire de ${who} dans ${daysBeforeBirthday} jours`;

    const html = getBirthdayReminderTemplate({
      name,
      surname,
      daysBeforeBirthday,
      birthdayLink,
      appLink,
      unsubscribeAllLink,
      unsubscribeSpecificLink,
    });

    const text = getBirthdayReminderTextVersion({
      name,
      surname,
      daysBeforeBirthday,
      birthdayLink,
      appLink,
      unsubscribeAllLink,
      unsubscribeSpecificLink,
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
      `✅ Email anniversaire J-${daysBeforeBirthday} envoyé à ${owner.email} pour ${who}`,
    );
  } catch (error) {
    console.error(
      `❌ Erreur envoi email anniversaire à ${owner.email}:`,
      error,
    );
  }
}

module.exports = {
  getBirthdayReminderTemplate,
  getBirthdayReminderTextVersion,
  sendBirthdayReminderEmail,
};
