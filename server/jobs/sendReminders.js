const cron = require("node-cron");
const dateModel = require("../models/date.model");
const User = require("../models/user.model");
const { sendPushToUser } = require("../services/pushService");
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
// HELPER: Construire le message push anniversaire
// ========================================
function buildBirthdayPushPayload(date, daysFromNow) {
  const firstName = date.name || "Quelqu'un";

  if (daysFromNow === 0) {
    return {
      title: `🎂 C'est l'anniversaire de ${firstName} !`,
      body: `Pensez à lui souhaiter un joyeux anniversaire 🎉`,
      url: "/home",
      tag: `birthday-${date._id}-today`,
    };
  }

  const dayLabel =
    daysFromNow === 1
      ? "demain"
      : daysFromNow === 7
        ? "dans 1 semaine"
        : daysFromNow === 14
          ? "dans 2 semaines"
          : daysFromNow === 30
            ? "dans 1 mois"
            : `dans ${daysFromNow} jours`;

  return {
    title: `🎂 Anniversaire de ${firstName} ${dayLabel}`,
    body: `N'oubliez pas de préparer quelque chose !`,
    url: "/home",
    tag: `birthday-${date._id}-${daysFromNow}`,
  };
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

      const prefs = date.notificationPreferences || {
        timings: [1],
        notifyOnBirthday: true,
      };

      const { timings = [1], notifyOnBirthday = true } = prefs;

      const owner = date.owner;

      // ── Push : vérifier les préférences une seule fois par owner ──
      const pushOk =
        owner.pushEnabled === true && owner.pushEvents?.birthdays !== false;

      const pushTimings = owner.pushBirthdayTimings || [1, 0];

      // Jour de l'anniversaire
      if (notifyOnBirthday && isBirthdayInXDays(date.date, 0)) {
        await sendBirthdayReminderEmail(owner, date, 0);

        if (pushOk && pushTimings.includes(0)) {
          await sendPushToUser(owner._id, buildBirthdayPushPayload(date, 0));
          console.log(
            `🔔 [PUSH] Anniversaire J de ${date.name} → ${owner.email}`,
          );
        }
      }

      // Rappels à l'avance
      for (const days of timings) {
        if (isBirthdayInXDays(date.date, days)) {
          await sendBirthdayReminderEmail(owner, date, days);

          if (pushOk && pushTimings.includes(days)) {
            await sendPushToUser(
              owner._id,
              buildBirthdayPushPayload(date, days),
            );
            console.log(
              `🔔 [PUSH] Anniversaire J-${days} de ${date.name} → ${owner.email}`,
            );
          }
        }
      }
    }
  } catch (error) {
    console.error("❌ Erreur rappels anniversaires cartes:", error);
  }
}

// ========================================
// RAPPELS FÊTES (nameday)
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

      // Rappels à l'avance
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
// PLANIFICATION : Test toutes les 10s
// ========================================
// const cronJob = cron.schedule(
//   "*/10 * * * * *",
//   async () => {
//     await checkAndSendAllReminders();
//   },
//   {
//     scheduled: false,
//     timezone: "Europe/Paris",
//   },
// );

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
  checkAndSendAllReminders,
};
