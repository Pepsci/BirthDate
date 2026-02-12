const cron = require("node-cron");
const { SESClient } = require("@aws-sdk/client-ses");
const nodemailer = require("nodemailer");
const dateModel = require("../models/date.model");

// Import des templates HTML et texte
const {
  getBirthdayReminderTemplate,
  getBirthdayReminderTextVersion,
} = require("../services/emailTemplates/birthdayReminder");

// Création du client SES avec AWS SDK v3
const sesClient = new SESClient({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

// Création d'un transporteur personnalisé avec SES v3
const transporter = nodemailer.createTransport({
  send: async (mail, callback) => {
    try {
      const message = await new Promise((resolve, reject) => {
        mail.message.build((error, message) => {
          if (error) {
            reject(error);
          } else {
            resolve(message);
          }
        });
      });

      const { SendRawEmailCommand } = require("@aws-sdk/client-ses");
      const command = new SendRawEmailCommand({
        RawMessage: { Data: message },
      });

      const response = await sesClient.send(command);
      callback(null, response);
    } catch (error) {
      console.error("Erreur lors de l'envoi de l'email:", error);
      callback(error);
    }
  },
  name: "ses-v3-transport",
});

// Fonction utilitaire pour vérifier si un anniversaire est à X jours
function isBirthdayInXDays(birthday, daysFromNow) {
  const today = new Date();
  const futureDate = new Date(today);
  futureDate.setDate(today.getDate() + daysFromNow);

  return (
    futureDate.getDate() === birthday.getDate() &&
    futureDate.getMonth() === birthday.getMonth()
  );
}

// Fonction principale pour vérifier et envoyer des emails
async function checkAndSendBirthdayEmails() {
  try {
    console.log("🎂 [CRON] Vérification des anniversaires...");

    // Récupérer toutes les dates avec leurs propriétaires
    const dateList = await dateModel.find().populate("owner");

    let emailsSent = 0;

    // Pour chaque date, vérifier si nous devons envoyer une notification
    for (const dateItem of dateList) {
      // Vérifier si l'utilisateur existe, a une adresse email, et accepte les notifications
      if (
        !dateItem.owner ||
        !dateItem.owner.email ||
        dateItem.owner.receiveBirthdayEmails === false ||
        dateItem.receiveNotifications === false
      ) {
        continue;
      }

      const birthday = new Date(dateItem.date);

      // Récupérer les préférences de notification
      const preferences = dateItem.notificationPreferences || {};
      const reminders = preferences.timings || [1]; // Par défaut 1 jour avant
      const notifyOnBirthday = preferences.notifyOnBirthday || false;

      // Vérifier pour le rappel le jour même si activé
      if (notifyOnBirthday && isBirthdayInXDays(birthday, 0)) {
        await sendReminderEmail(
          dateItem.owner.email,
          dateItem.name,
          dateItem.surname,
          0,
          dateItem._id,
        );
        emailsSent++;
        console.log(
          `✅ Email envoyé pour ${dateItem.name} ${dateItem.surname} (jour même)`,
        );
      }

      // Vérifier pour chaque délai de rappel configuré
      for (const daysBeforeBirthday of reminders) {
        if (isBirthdayInXDays(birthday, daysBeforeBirthday)) {
          await sendReminderEmail(
            dateItem.owner.email,
            dateItem.name,
            dateItem.surname,
            daysBeforeBirthday,
            dateItem._id,
          );
          emailsSent++;
          console.log(
            `✅ Email envoyé pour ${dateItem.name} ${dateItem.surname} (${daysBeforeBirthday} jours avant)`,
          );
        }
      }
    }

    console.log(
      `🎂 [CRON] Vérification terminée - ${emailsSent} email(s) envoyé(s)`,
    );
  } catch (error) {
    console.error(
      "❌ [CRON] Erreur lors de la vérification des anniversaires:",
      error,
    );
  }
}

// Envoi d'email avec template HTML
async function sendReminderEmail(
  email,
  name,
  surname,
  daysBeforeBirthday,
  dateId,
) {
  const encodedEmail = encodeURIComponent(email);
  const birthdayLink = `${process.env.FRONTEND_URL}/birthday/${dateId}`;
  const unsubscribeAllLink = `${process.env.FRONTEND_URL}/api/unsubscribe?email=${encodedEmail}`;
  const unsubscribeSpecificLink = `${process.env.FRONTEND_URL}/api/unsubscribe?email=${encodedEmail}&dateid=${dateId}`;

  // Définir le sujet selon le délai
  let subject;
  if (daysBeforeBirthday === 0) {
    subject = `C'est aujourd'hui l'anniversaire de ${name} ${surname} ! 🎉`;
  } else if (daysBeforeBirthday === 1) {
    subject = `Rappel: Anniversaire demain ! 🎂`;
  } else {
    subject = `Rappel: Anniversaire dans ${daysBeforeBirthday} jours 📅`;
  }

  const templateData = {
    name,
    surname,
    daysBeforeBirthday,
    birthdayLink,
    unsubscribeAllLink,
    unsubscribeSpecificLink,
  };

  const htmlContent = getBirthdayReminderTemplate(templateData);
  const textContent = getBirthdayReminderTextVersion(templateData);

  const mailOptions = {
    from: `Birthday <${process.env.EMAIL_BRTHDAY}>`,
    to: email,
    subject: subject,
    text: textContent,
    html: htmlContent,
    headers: {
      "List-Unsubscribe": `<${unsubscribeAllLink}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  };

  return new Promise((resolve, reject) => {
    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.error("Erreur lors de l'envoi de l'email:", error);
        reject(error);
      } else {
        resolve(info);
      }
    });
  });
}

// Planification : tous les jours à minuit (0h)
const birthdayEmailCron = cron.schedule(
  "0 0 * * *",
  checkAndSendBirthdayEmails,
  {
    scheduled: false, // Important : ne démarre PAS automatiquement
  },
);

// Pour tester : décommenter la ligne ci-dessous (toutes les minutes)
// const birthdayEmailCron = cron.schedule("*/1 * * * *", checkAndSendBirthdayEmails, { scheduled: false });

module.exports = birthdayEmailCron;
