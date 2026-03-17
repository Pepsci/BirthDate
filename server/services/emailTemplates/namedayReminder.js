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

function getNamedayReminderTemplate({
  name,
  surname,
  daysBeforeNameday,
  namedayLink,
  unsubscribeAllLink,
  unsubscribeSpecificLink,
  formattedDate,
}) {
  let badgeText, titleText, mainText;

  if (daysBeforeNameday === 0) {
    badgeText = "Aujourd'hui 🎉";
    titleText = "C'est sa fête !";
    mainText = `C'est aujourd'hui la fête de <strong>${name} ${surname}</strong> ! N'oubliez pas de lui souhaiter ! ✨`;
  } else if (daysBeforeNameday === 1) {
    badgeText = "Demain 🌸";
    titleText = "Fête demain";
    mainText = `La fête de <strong>${name} ${surname}</strong> est <strong>demain</strong> (${formattedDate}) !`;
  } else {
    badgeText = `Dans ${daysBeforeNameday} jours 📅`;
    titleText = `Fête dans ${daysBeforeNameday} jours`;
    mainText = `La fête de <strong>${name} ${surname}</strong> est dans <strong>${daysBeforeNameday} jours</strong> (${formattedDate}) !`;
  }

  return (
    emailHeader() +
    badge(badgeText) +
    title(titleText) +
    paragraph(mainText) +
    ctaButton(namedayLink, "Voir le profil") +
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
  return `${mainText}\n\nVoir le profil : ${namedayLink}\n\n---\nNe plus recevoir de rappels pour ${name} : ${unsubscribeSpecificLink}\nNe plus recevoir de rappels d'anniversaires : ${unsubscribeAllLink}`;
}

// ========================================
// FONCTION D'ENVOI
// ========================================
async function sendNamedayReminderEmail(date, daysBeforeNameday) {
  try {
    const owner = date.owner;
    if (!owner || !owner.email) return;

    const frontendUrl = process.env.FRONTEND_URL || "https://birthreminder.com";

    const name = date.name;
    const surname = date.surname || "";

    // Formater la date de fête lisible ex: "03-19" → "19 mars"
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

    const namedayLink = `${frontendUrl}/birthday/${date._id}`;
    const unsubscribeAllLink = `${frontendUrl}/unsubscribe?userId=${owner._id}&type=all`;
    const unsubscribeSpecificLink = `${frontendUrl}/unsubscribe?userId=${owner._id}&dateId=${date._id}&type=specific`;

    const subject =
      daysBeforeNameday === 0
        ? `✨ C'est la fête de ${name} ${surname} aujourd'hui !`
        : daysBeforeNameday === 1
          ? `✨ Fête de ${name} ${surname} demain !`
          : `✨ Fête de ${name} ${surname} dans ${daysBeforeNameday} jours`;

    const html = getNamedayReminderTemplate({
      name,
      surname,
      daysBeforeNameday,
      namedayLink,
      unsubscribeAllLink,
      unsubscribeSpecificLink,
      formattedDate,
    });

    const text = getNamedayReminderTextVersion({
      name,
      surname,
      daysBeforeNameday,
      namedayLink,
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
      `✅ Email fête J-${daysBeforeNameday} envoyé à ${owner.email} pour ${name} ${surname}`,
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
