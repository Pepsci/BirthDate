const {
  emailHeader,
  emailFooter,
  badge,
  title,
  paragraph,
  ctaButton,
} = require("./emailHelpers");

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

module.exports = {
  getBirthdayReminderTemplate,
  getBirthdayReminderTextVersion,
};
