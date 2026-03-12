const cron = require("node-cron");
const dateModel = require("../models/date.model");
const User = require("../models/user.model");
const {
  sendBirthdayReminderEmail,
} = require("../services/emailTemplates/birthdayReminder");
const {
  sendNamedayReminderEmail,
} = require("../services/emailTemplates/namedayReminder");

// ========================================
// HELPER: Vérifier si un anniversaire est dans X jours
// ========================================
function isBirthdayInXDays(birthDate, daysFromNow) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const targetDate = new Date(today);
  targetDate.setDate(today.getDate() + daysFromNow);

  const birth = new Date(birthDate);
  birth.setHours(0, 0, 0, 0);

  return (
    birth.getDate() === targetDate.getDate() &&
    birth.getMonth() === targetDate.getMonth()
  );
}

// ========================================
// HELPER: Vérifier si une fête (nameday) est dans X jours
// ========================================
function isNamedayInXDays(nameday, daysFromNow) {
  if (!nameday || !nameday.match(/^\d{2}-\d{2}$/)) {
    return false;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const targetDate = new Date(today);
  targetDate.setDate(today.getDate() + daysFromNow);

  const [month, day] = nameday.split("-");
  const namedayThisYear = new Date(
    targetDate.getFullYear(),
    parseInt(month) - 1,
    parseInt(day),
  );
  namedayThisYear.setHours(0, 0, 0, 0);

  return (
    namedayThisYear.getDate() === targetDate.getDate() &&
    namedayThisYear.getMonth() === targetDate.getMonth()
  );
}

// ========================================
// RAPPELS ANNIVERSAIRES (utilisateurs)
// ========================================
async function checkAndSendUserBirthdayReminders() {
  try {
    console.log(
      "🎂 [CRON] Vérification des rappels d'anniversaires utilisateurs...",
    );

    const users = await User.find({
      birthDate: { $exists: true, $ne: null },
      receiveOwnBirthdayEmail: { $ne: false },
      receiveBirthdayEmails: { $ne: false },
    });

    for (const user of users) {
      if (isBirthdayInXDays(user.birthDate, 0)) {
        console.log(`🎉 Anniversaire de ${user.email} aujourd'hui !`);
        await sendBirthdayReminderEmail(user, null, 0);
      }
    }
  } catch (error) {
    console.error("❌ Erreur rappels anniversaires utilisateurs:", error);
  }
}

// ========================================
// RAPPELS ANNIVERSAIRES (cartes)
// ========================================
async function checkAndSendCardBirthdayReminders() {
  try {
    console.log("🎂 [CRON] Vérification des rappels d'anniversaires cartes...");

    const dates = await dateModel
      .find({
        receiveNotifications: { $ne: false },
      })
      .populate("owner linkedUser");

    for (const date of dates) {
      if (!date.owner || !date.owner.receiveBirthdayEmails) continue;

      // Utiliser notificationPreferences pour les ANNIVERSAIRES
      const prefs = date.notificationPreferences || {
        timings: [1],
        notifyOnBirthday: true,
      };

      const { timings = [1], notifyOnBirthday = true } = prefs;

      // Jour de l'anniversaire
      if (notifyOnBirthday && isBirthdayInXDays(date.date, 0)) {
        await sendBirthdayReminderEmail(date.owner, date, 0);
      }

      // Rappels à l'avance
      for (const days of timings) {
        if (isBirthdayInXDays(date.date, days)) {
          await sendBirthdayReminderEmail(date.owner, date, days);
        }
      }
    }
  } catch (error) {
    console.error("❌ Erreur rappels anniversaires cartes:", error);
  }
}

// ========================================
// 🎉 RAPPELS FÊTES (nameday) - UTILISE namedayPreferences
// ========================================
async function checkAndSendNamedayReminders() {
  try {
    console.log("🎉 [CRON] Vérification des rappels de fêtes...");

    const datesWithNameday = await dateModel
      .find({
        nameday: { $exists: true, $ne: null },
        receiveNotifications: { $ne: false },
      })
      .populate("owner linkedUser");

    for (const date of datesWithNameday) {
      if (!date.owner || !date.owner.receiveBirthdayEmails) continue;

      // 🎉 UTILISER namedayPreferences au lieu de notificationPreferences
      const prefs = date.namedayPreferences || {
        timings: [1],
        notifyOnNameday: true,
      };

      const { timings = [1], notifyOnNameday = true } = prefs;

      // Jour de la fête
      if (notifyOnNameday && isNamedayInXDays(date.nameday, 0)) {
        console.log(`🎉 Fête de ${date.name} aujourd'hui !`);
        await sendNamedayReminderEmail(date, 0);
      }

      // Rappels à l'avance (1 jour ou 7 jours)
      for (const days of timings) {
        if (isNamedayInXDays(date.nameday, days)) {
          console.log(`📅 Rappel fête de ${date.name} dans ${days} jour(s)`);
          await sendNamedayReminderEmail(date, days);
        }
      }
    }
  } catch (error) {
    console.error("❌ Erreur rappels fêtes:", error);
  }
}

// ========================================
// FONCTION PRINCIPALE
// ========================================
async function checkAndSendAllReminders() {
  console.log("\n📧 [CRON] Démarrage de la vérification des rappels...");
  await checkAndSendUserBirthdayReminders();
  await checkAndSendCardBirthdayReminders();
  await checkAndSendNamedayReminders();
  console.log("✅ [CRON] Vérification terminée\n");
}

// ========================================
// PLANIFICATION : Tous les jours à minuit
// ========================================
const cronJob = cron.schedule(
  "0 0 * * *",
  async () => {
    await checkAndSendAllReminders();
  },
  {
    scheduled: false,
    timezone: "Europe/Paris",
  },
);

// ========================================
// EXPORTS
// ========================================
module.exports = {
  start: () => {
    cronJob.start();
    console.log(
      "✅ Emails anniversaires & fêtes planifiés (tous les jours à minuit)",
    );
  },
  checkAndSendAllReminders, // Pour les tests manuels
};
