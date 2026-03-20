const { SESClient, SendEmailCommand } = require("@aws-sdk/client-ses");
const {
  emailHeader,
  emailFooter,
  badge,
  title,
  paragraph,
  ctaButton,
} = require("./emailHelpers");

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
  unsubscribeAllLink,
  unsubscribeSpecificLink,
}) => {
  let badgeText, titleText, message;

  if (daysBeforeBirthday === 0) {
    badgeText = "Aujourd'hui 🎉";
    titleText = "C'est son anniversaire !";
    message = `L'anniversaire de <strong>${name} ${surname}</strong> est <strong>aujourd'hui</strong> ! N'oubliez pas de lui souhaiter ! 🎂`;
  } else if (daysBeforeBirthday === 1) {
    badgeText = "Demain 🎂";
    titleText = "Anniversaire demain";
    message = `L'anniversaire de <strong>${name} ${surname}</strong> est <strong>demain</strong> ! Préparez vos souhaits !`;
  } else {
    badgeText = `Dans ${daysBeforeBirthday} jours 📅`;
    titleText = `Anniversaire dans ${daysBeforeBirthday} jours`;
    message = `L'anniversaire de <strong>${name} ${surname}</strong> arrive dans <strong>${daysBeforeBirthday} jours</strong>. Pensez à lui !`;
  }

  return (
    emailHeader() +
    badge(badgeText) +
    title(titleText) +
    paragraph(message) +
    ctaButton(birthdayLink, "Voir le profil") +
    emailFooter(`
      <p style="margin:0 0 4px;font-size:12px;color:#6b7280;">
        <a href="${unsubscribeSpecificLink}" style="color:#818cf8;text-decoration:none;">
          Ne plus recevoir de rappels pour ${name} ${surname}
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
  return `${message}\n\nVoir le profil : ${birthdayLink}\n\n---\nNe plus recevoir de rappels pour ${name} : ${unsubscribeSpecificLink}\nSe désabonner de tous les rappels : ${unsubscribeAllLink}`;
};

async function sendBirthdayReminderEmail(owner, date, daysBeforeBirthday) {
  try {
    const frontendUrl = process.env.FRONTEND_URL || "https://birthreminder.com";

    const name = date ? date.name : owner.name;
    const surname = date ? date.surname : owner.surname || "";
    const dateId = date ? date._id : null;

    // CORRIGÉ : deep link vers /home?tab=date&dateId= au lieu de /birthday/:id
    const birthdayLink = dateId
      ? `${frontendUrl}/home?tab=date&dateId=${dateId}`
      : `${frontendUrl}/home`;

    const unsubscribeAllLink = `${frontendUrl}/unsubscribe?userId=${owner._id}&type=all`;
    const unsubscribeSpecificLink = dateId
      ? `${frontendUrl}/unsubscribe?userId=${owner._id}&dateId=${dateId}&type=specific`
      : unsubscribeAllLink;

    const subject =
      daysBeforeBirthday === 0
        ? `🎂 C'est l'anniversaire de ${name} ${surname} aujourd'hui !`
        : daysBeforeBirthday === 1
          ? `🎂 Anniversaire de ${name} ${surname} demain !`
          : `🎂 Anniversaire de ${name} ${surname} dans ${daysBeforeBirthday} jours`;

    const html = getBirthdayReminderTemplate({
      name,
      surname,
      daysBeforeBirthday,
      birthdayLink,
      unsubscribeAllLink,
      unsubscribeSpecificLink,
    });

    const text = getBirthdayReminderTextVersion({
      name,
      surname,
      daysBeforeBirthday,
      birthdayLink,
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
      `✅ Email anniversaire J-${daysBeforeBirthday} envoyé à ${owner.email} pour ${name} ${surname}`,
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
