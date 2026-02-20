const cron = require("node-cron");
const { SESClient, SendEmailCommand } = require("@aws-sdk/client-ses");
const nodemailer = require("nodemailer");
const dateModel = require("../models/date.model");
const userModel = require("../models/user.model"); // ✅ ajouté

const {
  getBirthdayReminderTemplate,
  getBirthdayReminderTextVersion,
} = require("../services/emailTemplates/birthdayReminder");

const sesClient = new SESClient({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const transporter = nodemailer.createTransport({
  send: async (mail, callback) => {
    try {
      const message = await new Promise((resolve, reject) => {
        mail.message.build((error, message) => {
          if (error) reject(error);
          else resolve(message);
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

function isBirthdayInXDays(birthday, daysFromNow) {
  const today = new Date();
  const futureDate = new Date(today);
  futureDate.setDate(today.getDate() + daysFromNow);

  return (
    futureDate.getDate() === birthday.getDate() &&
    futureDate.getMonth() === birthday.getMonth()
  );
}

// ✅ NOUVEAU : Email d'anniversaire à l'utilisateur lui-même
async function checkAndSendUserBirthdayEmails() {
  try {
    console.log("🎂 [CRON] Vérification des anniversaires utilisateurs...");

    const users = await userModel.find({
      birthDate: { $exists: true, $ne: null },
      isVerified: true,
      receiveBirthdayEmails: true,
      receiveOwnBirthdayEmail: { $ne: true },
      deletedAt: null,
    });

    let emailsSent = 0;

    for (const user of users) {
      if (!user.email || !user.birthDate) continue;

      const birthday = new Date(user.birthDate);

      if (isBirthdayInXDays(birthday, 0)) {
        await sendUserBirthdayEmail(user);
        emailsSent++;
        console.log(
          `🎉 Email d'anniversaire envoyé à ${user.name} (${user.email})`,
        );
      }
    }

    console.log(
      `🎂 [CRON] ${emailsSent} email(s) d'anniversaire utilisateur envoyé(s)`,
    );
  } catch (error) {
    console.error(
      "❌ [CRON] Erreur vérification anniversaires utilisateurs:",
      error,
    );
  }
}

// ✅ NOUVEAU : Template email anniversaire utilisateur
async function sendUserBirthdayEmail(user) {
  const encodedEmail = encodeURIComponent(user.email);
  const profileLink = `${process.env.FRONTEND_URL}/home`;
  const unsubscribeLink = `${process.env.FRONTEND_URL}/unsubscribe?email=${encodedEmail}`;

  const htmlContent = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;background-color:#1a1a2e;color:#ffffff;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color:#1a1a2e;">
    <tr>
      <td style="padding:40px 20px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width:600px;margin:0 auto;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);border-radius:16px;overflow:hidden;box-shadow:0 10px 40px rgba(0,0,0,0.3);">
          <tr>
            <td style="padding:40px 40px 20px 40px;text-align:center;">
              <h1 style="margin:0;font-size:32px;font-weight:700;color:#ffffff;">🎉 BirthReminder</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:0 40px 20px 40px;text-align:center;">
              <div style="display:inline-block;background-color:rgba(255,255,255,0.2);padding:8px 20px;border-radius:20px;">
                <span style="font-size:14px;font-weight:600;text-transform:uppercase;letter-spacing:1px;">
                  Joyeux Anniversaire ! 🎂
                </span>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:0 40px 30px 40px;text-align:center;">
              <p style="margin:0;font-size:24px;font-weight:700;color:#ffffff;">
                Joyeux anniversaire ${user.name} ! 🎉
              </p>
              <p style="margin:16px 0 0 0;font-size:16px;line-height:1.6;color:rgba(255,255,255,0.9);">
                Toute l'équipe BirthReminder vous souhaite un merveilleux anniversaire !
              </p>
              <p style="margin:12px 0 0 0;font-size:15px;line-height:1.6;color:rgba(255,255,255,0.8);">
                Profitez de cette belle journée 🥳
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 40px 40px 40px;text-align:center;">
              <a href="${profileLink}" style="display:inline-block;background-color:#ffffff;color:#667eea;text-decoration:none;padding:16px 40px;border-radius:8px;font-weight:600;font-size:16px;box-shadow:0 4px 15px rgba(0,0,0,0.2);">
                Voir mon profil →
              </a>
            </td>
          </tr>
        </table>
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width:600px;margin:20px auto 0 auto;">
          <tr>
            <td style="padding:20px;text-align:center;font-size:12px;color:#888;line-height:1.6;">
              <p style="margin:0;">
                <a href="${unsubscribeLink}" style="color:#667eea;text-decoration:none;">
                  Ne plus recevoir ces notifications
                </a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const mailOptions = {
    from: `BirthReminder <${process.env.EMAIL_BRTHDAY}>`,
    to: user.email,
    subject: `🎉 Joyeux anniversaire ${user.name} !`,
    html: htmlContent,
    text: `Joyeux anniversaire ${user.name} ! Toute l'équipe BirthReminder vous souhaite un merveilleux anniversaire !\n\nVoir mon profil : ${profileLink}\n\nSe désabonner : ${unsubscribeLink}`,
    headers: {
      "List-Unsubscribe": `<${unsubscribeLink}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  };

  return new Promise((resolve, reject) => {
    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.error("Erreur envoi email:", error);
        reject(error);
      } else resolve(info);
    });
  });
}

async function checkAndSendBirthdayEmails() {
  try {
    console.log("🎂 [CRON] Vérification des anniversaires...");

    // ✅ Vérification anniversaires utilisateurs
    await checkAndSendUserBirthdayEmails();

    const dateList = await dateModel.find().populate("owner");
    let emailsSent = 0;

    for (const dateItem of dateList) {
      if (
        !dateItem.owner ||
        !dateItem.owner.email ||
        dateItem.owner.receiveBirthdayEmails === false ||
        dateItem.receiveNotifications === false
      )
        continue;

      const birthday = new Date(dateItem.date);
      const preferences = dateItem.notificationPreferences || {};
      const reminders = preferences.timings || [1];
      const notifyOnBirthday = preferences.notifyOnBirthday || false;

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

  let subject;
  if (daysBeforeBirthday === 0)
    subject = `C'est aujourd'hui l'anniversaire de ${name} ${surname} ! 🎉`;
  else if (daysBeforeBirthday === 1)
    subject = `Rappel: Anniversaire demain ! 🎂`;
  else subject = `Rappel: Anniversaire dans ${daysBeforeBirthday} jours 📅`;

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
    subject,
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
      } else resolve(info);
    });
  });
}

const birthdayEmailCron = cron.schedule(
  "0 0 * * *",
  checkAndSendBirthdayEmails,
  {
    scheduled: false,
  },
);

module.exports = birthdayEmailCron;

// Pour tester : décommenter la ligne ci-dessous (toutes les minutes)
// const birthdayEmailCron = cron.schedule("*/1 * * * *", checkAndSendBirthdayEmails, { scheduled: false });
