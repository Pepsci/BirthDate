const AWS = require("aws-sdk");
const nodemailer = require("nodemailer");
const dateModel = require("../models/date.model");
const schedule = require("node-schedule");

// Configure AWS SDK
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

// Create Nodemailer SES transporter
const transporter = nodemailer.createTransport({
  SES: new AWS.SES({
    apiVersion: "2010-12-01",
  }),
});

// Function to send birthday email
async function sendBirthdayEmail() {
  try {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const dateList = await dateModel.find().populate("owner");
    dateList.forEach((dateItem) => {
      const birthday = new Date(dateItem.date);
      if (
        tomorrow.getDate() === birthday.getDate() &&
        tomorrow.getMonth() === birthday.getMonth() &&
        dateItem.owner &&
        dateItem.owner.email &&
        dateItem.owner.receiveBirthdayEmails
      ) {
        const unsubscribeLink = `https://birthreminder.com/unsubscribe?userId=${dateItem.owner._id}`;

        let mailOptions = {
          from: process.env.EMAIL_BRTHDAY,
          to: dateItem.owner.email,
          subject: "Rappel: Anniversaire à venir!",
          text: `Rappelez-vous que demain est l'anniversaire de ${dateItem.name} ${dateItem.surname} !\n\nPour vous désabonner des notifications, cliquez sur ce lien : ${unsubscribeLink}`,
          html: `<p>Rappelez-vous que demain est l'anniversaire de ${dateItem.name} ${dateItem.surname} !</p>
                 <p>Pour vous désabonner des notifications, cliquez sur ce lien : <a href="${unsubscribeLink}">Se désabonner</a></p>`,
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

// Schedule a task to check birthdays every day at midnight
schedule.scheduleJob("0 0 * * *", sendBirthdayEmail);

// Call the function for a test
sendBirthdayEmail();
