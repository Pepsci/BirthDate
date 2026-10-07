const cron = require("node-cron");
const dateModel = require("../models/date.model");
const User = require("../models/user.model");
const { sendPushToUser } = require("../services/pushService");
const { emailsFor } = require("../services/emailTemplates/localized");

// notify nécessite l'instance app : on la reçoit via init()
let _app = null;
const initApp = (app) => {
  _app = app;
};

// ========================================
// HELPER: Vérifier si un anniversaire est dans X jours
// ========================================
function isBirthdayInXDays(birthDate, daysFromNow) {
  const today = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Europe/Paris" }),
  );
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
  if (!nameday || !nameday.match(/^\d{2}-\d{2}$/)) return false;

  const today = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Europe/Paris" }),
  );
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
// HELPER: Réclamer un rappel (idempotence)
// ========================================
const ReminderClaim = require("../models/reminderClaim.model");

/**
 * Tente de "réclamer" l'envoi d'un rappel pour aujourd'hui. Retourne `true`
 * la première fois (le rappel peut partir), `false` si déjà réclamé : que ce
 * soit par ce même passage du cron ou un autre processus qui tournerait en
 * parallèle (voir le commentaire dans reminderClaim.model.js). Un rappel non
 * réclamé (erreur DB autre qu'un doublon) est traité comme "peut partir" :
 * mieux vaut un doublon occasionnel qu'un rappel silencieusement perdu.
 */
async function claimReminder(subjectId, kind, daysLeft) {
  const sentDate = new Date()
    .toLocaleString("en-CA", { timeZone: "Europe/Paris" })
    .slice(0, 10); // "YYYY-MM-DD"
  try {
    await ReminderClaim.create({ subjectId, kind, daysLeft, sentDate });
    return true;
  } catch (error) {
    if (error?.code === 11000) return false; // déjà réclamé aujourd'hui
    console.error("❌ Erreur claimReminder (on envoie quand même):", error);
    return true;
  }
}

// ========================================
// HELPER: Prénom affichable d'une carte
// ========================================
/**
 * Une carte liée à un ami inscrit peut ne pas porter de prénom propre : on
 * retombe alors sur celui du compte lié, plutôt que d'afficher "Quelqu'un"
 * (ou "undefined" là où l'interpolation n'était pas protégée).
 */
function displayName(date) {
  // trim : un prénom saisi « Raphaël  » donnait « C'est la fête de Raphaël  ! »
  const name = (date.name || date.linkedUser?.name || "").trim();
  return name || "Quelqu'un";
}

// ========================================
// HELPER: Construire le message push anniversaire
// ========================================
/**
 * Prénom pour un texte traduit : même règle que displayName(), mais le repli
 * « Quelqu'un » suit la langue du destinataire.
 */
function nameIn(date, L) {
  const name = (date.name || date.linkedUser?.name || "").trim();
  return name || L("push.someone");
}

/**
 * ⚠️ `title` et `body` sont des fonctions `(L) => …` : sendPushToUser les
 * résout dans la langue du compte destinataire (services/pushService.js).
 * Les libellés français sont dans i18n/locales/fr.json, inchangés.
 */
function buildBirthdayPushPayload(date, daysFromNow) {
  if (daysFromNow === 0) {
    return {
      title: (L) => L("push.birthday.todayTitle", { name: nameIn(date, L) }),
      body: (L) => L("push.birthday.todayBody"),
      // Deep link vers la carte de la personne (web : FriendProfile, mobile : /date/:id)
      url: `/home?tab=date&dateId=${date._id}`,
      tag: `birthday-${date._id}-today`,
      type: "birthday",
    };
  }

  const dayLabel = (L) =>
    daysFromNow === 1
      ? L("push.when.tomorrow")
      : daysFromNow === 7
        ? L("push.when.week1")
        : daysFromNow === 14
          ? L("push.when.week2")
          : daysFromNow === 30
            ? L("push.when.month1")
            : L("push.when.inDays", { count: daysFromNow });

  return {
    title: (L) =>
      L("push.birthday.soonTitle", { name: nameIn(date, L), when: dayLabel(L) }),
    body: (L) => L("push.birthday.soonBody"),
    url: `/home?tab=date&dateId=${date._id}`,
    tag: `birthday-${date._id}-${daysFromNow}`,
    type: "birthday",
  };
}

// ========================================
// HELPER: Construire le message push fête
// ========================================
function buildNamedayPushPayload(date, daysFromNow) {
  if (daysFromNow === 0) {
    return {
      title: (L) => L("push.nameday.todayTitle", { name: nameIn(date, L) }),
      body: (L) => L("push.nameday.todayBody"),
      url: `/home?tab=date&dateId=${date._id}`,
      tag: `nameday-${date._id}-today`,
      type: "nameday",
    };
  }

  const dayLabel = (L) =>
    daysFromNow === 1
      ? L("push.when.tomorrow")
      : daysFromNow === 7
        ? L("push.when.week1")
        : L("push.when.inDays", { count: daysFromNow });

  return {
    title: (L) =>
      L("push.nameday.soonTitle", { name: nameIn(date, L), when: dayLabel(L) }),
    body: (L) => L("push.nameday.soonBody"),
    url: `/home?tab=date&dateId=${date._id}`,
    tag: `nameday-${date._id}-${daysFromNow}`,
    type: "nameday",
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
      if (
        isBirthdayInXDays(user.birthDate, 0) &&
        (await claimReminder(user._id, "user_birthday", 0))
      ) {
        console.log(`🎉 Anniversaire de ${user.email} aujourd'hui !`);
        await emailsFor(user.language).sendBirthdayReminderEmail(user, null, 0);
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

    const { notify } = require("../utils/notify");

    const dates = await dateModel
      .find({ receiveNotifications: { $ne: false } })
      .populate("owner linkedUser");

    for (const date of dates) {
      if (!date.owner) continue;

      const prefs = date.notificationPreferences || {
        timings: [1],
        notifyOnBirthday: true,
      };

      const { timings = [1], notifyOnBirthday = true } = prefs;
      const owner = date.owner;

      // ⚠️ Les 3 canaux sont indépendants. `receiveBirthdayEmails` est présenté
      // à l'utilisateur comme un réglage EMAIL : il ne doit couper que l'email.
      // Avant, un `continue` en tête de boucle coupait aussi la notif in-app et
      // la push : d'où des utilisateurs qui ne recevaient plus rien du tout.
      // Le seul interrupteur global "cette personne", c'est
      // `date.receiveNotifications`, déjà filtré dans la requête ci-dessus.
      const emailOk = owner.receiveBirthdayEmails !== false;
      const pushOk =
        owner.pushEnabled === true && owner.pushEvents?.birthdays !== false;
      const pushTimings = owner.pushBirthdayTimings || [1, 0];

      if (
        notifyOnBirthday &&
        isBirthdayInXDays(date.date, 0) &&
        (await claimReminder(date._id, "birthday_card", 0))
      ) {
        if (emailOk)
          await emailsFor(owner.language).sendBirthdayReminderEmail(owner, date, 0);

        // ── Notif applicative J ──
        if (_app) {
          await notify(_app, {
            userId: owner._id,
            type: "birthday_soon",
            data: { name: displayName(date), daysLeft: 0 },
            link: `/home?tab=date&dateId=${date._id}`,
          });
        }

        if (pushOk && pushTimings.includes(0)) {
          await sendPushToUser(owner._id, buildBirthdayPushPayload(date, 0));
        }
      }

      for (const days of timings) {
        if (
          isBirthdayInXDays(date.date, days) &&
          (await claimReminder(date._id, "birthday_card", days))
        ) {
          if (emailOk)
            await emailsFor(owner.language).sendBirthdayReminderEmail(
              owner,
              date,
              days,
            );

          // ── Notif applicative J-X ──
          if (_app) {
            await notify(_app, {
              userId: owner._id,
              type: "birthday_soon",
              data: { name: displayName(date), daysLeft: days },
              link: `/home?tab=date&dateId=${date._id}`,
            });
          }

          if (pushOk && pushTimings.includes(days)) {
            await sendPushToUser(
              owner._id,
              buildBirthdayPushPayload(date, days),
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

    const { notify } = require("../utils/notify");

    const datesWithNameday = await dateModel
      .find({
        nameday: { $exists: true, $ne: null },
        receiveNotifications: { $ne: false },
      })
      .populate("owner linkedUser");

    for (const date of datesWithNameday) {
      if (!date.owner) continue;

      const prefs = date.namedayPreferences || {
        timings: [1],
        notifyOnNameday: true,
      };

      const { timings = [1], notifyOnNameday = true } = prefs;
      const owner = date.owner;

      // Même règle que les anniversaires : `receiveNamedayEmails` ne coupe que
      // l'email, jamais la notif in-app ni la push. Voir le commentaire dans
      // checkAndSendCardBirthdayReminders().
      const emailOk = owner.receiveNamedayEmails !== false;
      // Catégorie push propre aux fêtes : elles suivaient l'interrupteur
      // « Anniversaires », on ne pouvait pas garder l'un sans l'autre.
      const pushOk =
        owner.pushEnabled === true && owner.pushEvents?.namedays !== false;
      const pushTimings = owner.pushBirthdayTimings || [1, 0];

      if (
        notifyOnNameday &&
        isNamedayInXDays(date.nameday, 0) &&
        (await claimReminder(date._id, "nameday_card", 0))
      ) {
        console.log(`🎉 Fête de ${displayName(date)} aujourd'hui !`);
        if (emailOk)
          await emailsFor(owner.language).sendNamedayReminderEmail(date, 0);

        // ── Notif applicative J ──
        if (_app) {
          await notify(_app, {
            userId: owner._id,
            type: "nameday_soon",
            data: { name: displayName(date), daysLeft: 0 },
            link: `/home?tab=date&dateId=${date._id}`,
          });
        }

        if (pushOk && pushTimings.includes(0)) {
          await sendPushToUser(owner._id, buildNamedayPushPayload(date, 0));
        }
      }

      for (const days of timings) {
        if (
          isNamedayInXDays(date.nameday, days) &&
          (await claimReminder(date._id, "nameday_card", days))
        ) {
          console.log(`📅 Rappel fête de ${displayName(date)} dans ${days} jour(s)`);
          if (emailOk)
            await emailsFor(owner.language).sendNamedayReminderEmail(date, days);

          // ── Notif applicative J-X ──
          if (_app) {
            await notify(_app, {
              userId: owner._id,
              type: "nameday_soon",
              data: { name: displayName(date), daysLeft: days },
              link: `/home?tab=date&dateId=${date._id}`,
            });
          }

          if (pushOk && pushTimings.includes(days)) {
            await sendPushToUser(
              owner._id,
              buildNamedayPushPayload(date, days),
            );
          }
        }
      }
    }
  } catch (error) {
    console.error("❌ Erreur rappels fêtes:", error);
  }
}

// ========================================
// RÉCAP MENSUEL
// ========================================
async function checkAndSendMonthlyRecap() {
  try {
    console.log("📅 [CRON] Envoi des récaps mensuels...");

    // ⚠️ Le récap a SON réglage (`monthlyRecap`) et ne dépend d'aucun autre.
    // Il exigeait aussi `receiveBirthdayEmails` : décocher « rappels
    // d'anniversaire » coupait le récap sans le dire, alors que les deux
    // cases sont présentées côte à côte comme indépendantes.
    const users = await User.find({
      monthlyRecap: true,
      deletedAt: { $exists: false },
    });

    for (const user of users) {
      const dates = await dateModel
        .find({ owner: user._id })
        .populate("linkedUser", "name surname");
      await emailsFor(user.language).sendMonthlyRecapEmail(user, dates);
    }

    console.log(
      `✅ [CRON] Récaps mensuels envoyés à ${users.length} utilisateur(s)`,
    );
  } catch (error) {
    console.error("❌ Erreur récaps mensuels:", error);
  }
}

// ========================================
// FONCTION PRINCIPALE
// ========================================
async function checkAndSendAllReminders() {
  console.log("\n📧 [CRON] Démarrage de la vérification des rappels...");
  await checkAndSendUserBirthdayReminders();
  await checkAndSendCardBirthdayReminders();
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
  { scheduled: false, timezone: "Europe/Paris" },
);

// ========================================
// PLANIFICATION : Fêtes, tous les jours à 9h
// ========================================
// Séparé des anniversaires : un « Pensez à lui souhaiter une bonne fête » reçu
// à minuit tombe en pleine nuit et se perd dans les notifs du matin.
const namedayCronJob = cron.schedule(
  "0 9 * * *",
  async () => {
    await checkAndSendNamedayReminders();
  },
  { scheduled: false, timezone: "Europe/Paris" },
);

// ========================================
// PLANIFICATION : Récap mensuel, 1er du mois à 8h
// ========================================
const monthlyRecapJob = cron.schedule(
  "0 8 1 * *",
  async () => {
    await checkAndSendMonthlyRecap();
  },
  { scheduled: false, timezone: "Europe/Paris" },
);

// ========================================
// EXPORTS
// ========================================
module.exports = {
  initApp,
  start: () => {
    cronJob.start();
    namedayCronJob.start();
    monthlyRecapJob.start();
    console.log("✅ Rappels d'anniversaire planifiés (minuit)");
    console.log("✅ Rappels de fête planifiés (9h)");
    console.log("✅ Récap mensuel planifié (1er du mois à 8h)");
  },
  checkAndSendAllReminders,
  checkAndSendNamedayReminders,
  checkAndSendMonthlyRecap,
};
