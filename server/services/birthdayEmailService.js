// Importation de AWS SDK v3 pour SES
const { SESClient, SendEmailCommand } = require("@aws-sdk/client-ses");
const nodemailer = require("nodemailer");
const dateModel = require("../models/date.model");
const schedule = require("node-schedule");

// NOUVEAU : Import des templates HTML et texte
const {
  getBirthdayReminderTemplate,
  getBirthdayReminderTextVersion,
} = require("./emailTemplates/birthdayReminder");

// Création du client SES avec AWS SDK v3
const sesClient = new SESClient({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

// Création d'un transporteur personnalisé avec une fonction send pour utiliser SES v3
const transporter = nodemailer.createTransport({
  // Fonction d'envoi personnalisée qui utilise directement l'API SES v3
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

      // Importer dynamiquement SendRawEmailCommand pour éviter les conflits
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
    // Récupérer toutes les dates avec leurs propriétaires
    const dateList = await dateModel.find().populate("owner");

    // Pour chaque date, vérifier si nous devons envoyer une notification
    for (const dateItem of dateList) {
      // Vérifier si l'utilisateur existe, a une adresse email, et accepte les notifications par email
      if (
        !dateItem.owner ||
        !dateItem.owner.email ||
        dateItem.owner.receiveBirthdayEmails === false ||
        dateItem.receiveNotifications === false
      ) {
        continue; // Passer à la date suivante
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
          dateItem._id // L'ID de la date pour créer le lien
        );
        console.log(
          `Email envoyé pour ${dateItem.name} ${dateItem.surname} (jour même)`
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
            dateItem._id // L'ID de la date pour créer le lien
          );
          console.log(
            `Email envoyé pour ${dateItem.name} ${dateItem.surname} (${daysBeforeBirthday} jours avant)`
          );
        }
      }
    }

    console.log("Vérification des anniversaires terminée");
  } catch (error) {
    console.error("Erreur lors de la vérification des anniversaires:", error);
  }
}

// FONCTION MODIFIÉE : Envoi d'email avec le nouveau template HTML et le lien vers la page birthday
async function sendReminderEmail(
  email,
  name,
  surname,
  daysBeforeBirthday,
  dateId
) {
  // Création des liens
  const encodedEmail = encodeURIComponent(email);

  // NOUVEAU : Lien vers la page de l'anniversaire spécifique
  const birthdayLink = `${process.env.FRONTEND_URL}/birthday/${dateId}`;

  // Liens de désabonnement
  const unsubscribeAllLink = `${process.env.FRONTEND_URL}/api/unsubscribe?email=${encodedEmail}`;
  const unsubscribeSpecificLink = `${process.env.FRONTEND_URL}/api/unsubscribe?email=${encodedEmail}&dateid=${dateId}`;

  // Définir le sujet de l'email selon le délai
  let subject;
  if (daysBeforeBirthday === 0) {
    subject = `C'est aujourd'hui l'anniversaire de ${name} ${surname} ! 🎉`;
  } else if (daysBeforeBirthday === 1) {
    subject = `Rappel: Anniversaire demain ! 🎂`;
  } else {
    subject = `Rappel: Anniversaire dans ${daysBeforeBirthday} jours 📅`;
  }

  // Préparer les données pour le template
  const templateData = {
    name,
    surname,
    daysBeforeBirthday,
    birthdayLink,
    unsubscribeAllLink,
    unsubscribeSpecificLink,
  };

  // NOUVEAU : Générer le contenu HTML et texte à partir des templates
  const htmlContent = getBirthdayReminderTemplate(templateData);
  const textContent = getBirthdayReminderTextVersion(templateData);

  // Configuration de l'email
  const mailOptions = {
    from: `Birthday <${process.env.EMAIL_BRTHDAY}>`,
    to: email,
    subject: subject,
    text: textContent, // Version texte brut
    html: htmlContent, // Version HTML stylisée
    headers: {
      "List-Unsubscribe": `<${unsubscribeAllLink}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  };

  // Envoi de l'email via le transporteur
  return new Promise((resolve, reject) => {
    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.error("Erreur lors de l'envoi de l'email:", error);
        reject(error);
      } else {
        console.log("Email envoyé:", info.response);
        resolve(info);
      }
    });
  });
}

// Planification de la tâche quotidienne (tous les jours à minuit)
schedule.scheduleJob("0 0 * * *", checkAndSendBirthdayEmails);
// schedule.scheduleJob("*/1 * * * *", checkAndSendBirthdayEmails);

module.exports = { checkAndSendBirthdayEmails };
