const {
  emailHeader,
  emailFooter,
  badge,
  title,
  paragraph,
  ctaButton,
} = require("./emailHelpers");

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

module.exports = { getNamedayReminderTemplate, getNamedayReminderTextVersion };
