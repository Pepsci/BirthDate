const nodemailer = require("nodemailer");
const dateModel = require("../models/date.model");
const schedule = require("node-schedule");

// Créez un objet de transport pour l'envoi d'e-mails
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: 587,
  service: "hotmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  tls: {
    rejectUnauthorized: false,
  },
});

// Fonction pour envoyer un e-mail d'anniversaire
async function sendBirthdayEmail() {
  try {
    const today = new Date();
    const dateList = await dateModel.find();
    dateList.forEach((dateItem) => {
      const birthday = new Date(dateItem.date);
      if (
        today.getDate() === birthday.getDate() &&
        today.getMonth() === birthday.getMonth() &&
        dateItem.owner.email
      ) {
        // Si c'est l'anniversaire de quelqu'un aujourd'hui, envoyez un e-mail
        let mailOptions = {
          from: process.env.EMAIL_USER,
          to: dateItem.owner.email,
          subject: "Joyeux anniversaire!",
          text: `Joyeux anniversaire ${dateItem.name} ${dateItem.surname}!`,
        };
        transporter.sendMail(mailOptions, function (error, info) {
          if (error) {
            console.log(error);
          } else {
            console.log("Email sent: " + info.response);
          }
        });
      }
    });
  } catch (error) {
    console.error("Error fetching date list:", error);
  }
}

// Planifiez une tâche pour vérifier les anniversaires chaque jour à minuit
schedule.scheduleJob("0 0 * * *", sendBirthdayEmail);

// Appel de la fonction pour un test
sendBirthdayEmail();
