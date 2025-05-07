// Importation de AWS SDK v3 pour SES
const { SESClient, SendEmailCommand } = require("@aws-sdk/client-ses");
const nodemailer = require("nodemailer");
const dateModel = require("../models/date.model");
const schedule = require("node-schedule");

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
          dateItem._id // Passez l'ID de la date ici aussi
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
            dateItem._id // Passez l'ID de la date ici
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

// Fonction d'envoi d'email avec message personnalisé selon le délai
async function sendReminderEmail(
  email,
  name,
  surname,
  daysBeforeBirthday,
  dateId
) {
  let subject, textContent, htmlContent;

  if (daysBeforeBirthday === 0) {
    subject = `C'est aujourd'hui l'anniversaire de ${name} ${surname} !`;
    textContent = `N'oubliez pas que c'est aujourd'hui l'anniversaire de ${name} ${surname} !`;
    htmlContent = `<p>N'oubliez pas que c'est <strong>aujourd'hui</strong> l'anniversaire de ${name} ${surname} !</p>`;
  } else if (daysBeforeBirthday === 1) {
    subject = `Rappel: Anniversaire à venir demain !`;
    textContent = `Rappelez-vous que demain est l'anniversaire de ${name} ${surname} !`;
    htmlContent = `<p>Rappelez-vous que <strong>demain</strong> est l'anniversaire de ${name} ${surname} !</p>`;
  } else {
    subject = `Rappel: Anniversaire à venir dans ${daysBeforeBirthday} jours !`;
    textContent = `Rappelez-vous que dans ${daysBeforeBirthday} jours ce sera l'anniversaire de ${name} ${surname} !`;
    htmlContent = `<p>Rappelez-vous que dans <strong>${daysBeforeBirthday} jours</strong> ce sera l'anniversaire de ${name} ${surname} !</p>`;
  }

  // Création des liens de désabonnement
  const encodedEmail = encodeURIComponent(email);
  const unsubscribeAllLink = `${process.env.BACKEND_URL}/api/unsubscribe?email=${encodedEmail}`;
  const unsubscribeSpecificLink = `${process.env.BACKEND_URL}/api/unsubscribe?email=${encodedEmail}&dateid=${dateId}`;

  // Ajout des liens de désabonnement au contenu HTML
  htmlContent += `
    <p style="margin-top: 20px; padding-top: 10px; border-top: 1px solid #ddd; color: #777; font-size: 12px;">
      Options de notification :
      <ul style="margin-top: 5px;">
        <li><a href="${unsubscribeSpecificLink}">Ne plus recevoir de notifications pour l'anniversaire de ${name} ${surname}</a></li>
        <li><a href="${unsubscribeAllLink}">Ne plus recevoir aucune notification d'anniversaire</a></li>
      </ul>
    </p>
  `;

  // Ajout du lien de désabonnement spécifique au texte brut également
  textContent += `\n\nOptions de notification :\n- Ne plus recevoir de notifications pour l'anniversaire de ${name} ${surname} : ${unsubscribeSpecificLink}\n- Ne plus recevoir aucune notification d'anniversaire : ${unsubscribeAllLink}`;

  const mailOptions = {
    from: process.env.EMAIL_BRTHDAY,
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
        console.log("Email envoyé:", info.response);
        resolve(info);
      }
    });
  });
}

// Planification de la tâche quotidienne
schedule.scheduleJob("0 0 * * *", checkAndSendBirthdayEmails);

module.exports = { checkAndSendBirthdayEmails };
