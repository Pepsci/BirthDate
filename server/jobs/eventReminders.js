const cron = require("node-cron");
const Event = require("../models/event.model");
const EventInvitation = require("../models/eventInvitation.model");
const User = require("../models/user.model");
const { emailsFor } = require("../services/emailTemplates/localized");
const { sendPushToUser } = require("../services/pushService");

// notify nécessite l'instance app : on la reçoit via initApp()
let _app = null;
const initApp = (app) => {
  _app = app;
};

const frontendUrl = process.env.FRONTEND_URL || "https://birthreminder.com";

// ========================================
// HELPER: Vérifier si un événement est dans X jours
// ========================================
const isEventInXDays = (eventDate, daysFromNow) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const targetDate = new Date(today);
  targetDate.setDate(today.getDate() + daysFromNow);

  const evDate = new Date(eventDate);
  evDate.setHours(0, 0, 0, 0);

  return (
    evDate.getDate() === targetDate.getDate() &&
    evDate.getMonth() === targetDate.getMonth() &&
    evDate.getFullYear() === targetDate.getFullYear()
  );
};

// ========================================
// HELPER: Construire le message push événement
// ========================================
function buildEventPushPayload(event, daysFromNow) {
  // `title` / `body` en fonctions `(L) => …` : résolus dans la langue du
  // destinataire par sendPushToUser (services/pushService.js).
  const title = (L) => event.title || L("push.anEvent");

  if (daysFromNow === 0) {
    return {
      title: (L) => L("push.eventReminder.todayTitle", { title: title(L) }),
      body: (L) => L("push.eventReminder.todayBody"),
      url: `/event/${event.shortId}`,
      tag: `event-${event._id}-today`,
      type: "event",
    };
  }

  const dayLabel = (L) =>
    daysFromNow === 1
      ? L("push.when.tomorrow")
      : daysFromNow === 7
        ? L("push.when.week1")
        : L("push.when.inDays", { count: daysFromNow });

  return {
    title: (L) => `🎉 ${title(L)} ${dayLabel(L)}`,
    body: (L) => L("push.eventReminder.soonBody"),
    url: `/event/${event.shortId}`,
    tag: `event-${event._id}-${daysFromNow}`,
    type: "event",
  };
}

// ========================================
// RAPPELS ÉVÉNEMENTS
// ========================================
async function checkAndSendEventReminders() {
  try {
    console.log("📅 [CRON] Vérification des rappels d'événements...");

    const { notify } = require("../utils/notify");

    const events = await Event.find({
      status: "published",
      $or: [
        { dateMode: "fixed", fixedDate: { $ne: null } },
        { dateMode: "vote", selectedDate: { $ne: null } },
      ],
    });

    for (const event of events) {
      const eventDate =
        event.dateMode === "fixed" ? event.fixedDate : event.selectedDate;
      const url = `${frontendUrl}/event/${event.shortId}`;

      if (!event.reminders || event.reminders.length === 0) continue;

      for (let i = 0; i < event.reminders.length; i++) {
        const reminder = event.reminders[i];

        if (reminder.type === "event_date" && !reminder.sent) {
          if (isEventInXDays(eventDate, reminder.daysBeforeEvent)) {
            console.log(
              `⏳ Rappel J-${reminder.daysBeforeEvent} pour "${event.title}"`,
            );

            // Populate étendu pour avoir les prefs email et push des participants
            // `$nin: [event.organizer]` : l'organisateur a maintenant sa propre
            // EventInvitation (il figure dans les participants). Il est déjà
            // traité séparément plus bas : sans cette exclusion il recevrait
            // email et push en double.
            const invitations = await EventInvitation.find({
              event: event._id,
              status: { $in: ["accepted", "maybe"] },
              user: { $nin: [event.organizer] },
            }).populate(
              "user",
              "email _id language receiveEventEmails pushEnabled pushEvents pushEventTimings",
            );

            const organizer = await User.findById(event.organizer);

            // ── Emails ──
            // email → langue. Un compte reçoit l'email dans SA langue ; un
            // invité sans compte, dans celle de l'organisateur. Le premier
            // ajout gagne : un compte n'est jamais écrasé par son doublon
            // « externe ».
            const recipients = new Map();
            const addRecipient = (email, language) => {
              if (!recipients.has(email)) recipients.set(email, language);
            };

            if (
              organizer &&
              organizer.email &&
              organizer.receiveEventEmails !== false
            ) {
              addRecipient(organizer.email, organizer.language);
            }

            for (const inv of invitations) {
              if (
                inv.user &&
                inv.user.email &&
                inv.user.receiveEventEmails !== false
              ) {
                addRecipient(inv.user.email, inv.user.language);
              }
              // Invités externes : pas de préférence possible, on envoie toujours
            }
            // Les externes en dernier, pour que les comptes passent d'abord.
            for (const inv of invitations) {
              if (inv.externalEmail)
                addRecipient(inv.externalEmail, organizer?.language);
            }

            for (const [email, language] of recipients) {
              await emailsFor(language).sendEventReminderEmail(
                email,
                event,
                reminder.daysBeforeEvent,
                url,
              );
            }

            // ── Notif applicative → organisateur ──
            if (_app && event.organizer) {
              await notify(_app, {
                userId: event.organizer,
                type: "event_reminder",
                data: {
                  eventName: event.title,
                  daysLeft: reminder.daysBeforeEvent,
                },
                link: `/event/${event.shortId}`,
              });
            }

            // ── Notif applicative → participants connectés ──
            if (_app) {
              for (const inv of invitations) {
                if (inv.user && inv.user._id) {
                  if (inv.user._id.toString() === event.organizer?.toString())
                    continue;

                  await notify(_app, {
                    userId: inv.user._id,
                    type: "event_reminder",
                    data: {
                      eventName: event.title,
                      daysLeft: reminder.daysBeforeEvent,
                    },
                    link: `/event/${event.shortId}`,
                  });
                }
              }
            }

            // ── Push → organisateur ──
            if (
              organizer &&
              organizer.pushEnabled === true &&
              organizer.pushEvents?.events !== false
            ) {
              const pushTimings = organizer.pushEventTimings || [1];
              if (pushTimings.includes(reminder.daysBeforeEvent)) {
                await sendPushToUser(
                  organizer._id,
                  buildEventPushPayload(event, reminder.daysBeforeEvent),
                );
              }
            }

            // ── Push → participants connectés ──
            // Les données push sont déjà disponibles via le populate
            for (const inv of invitations) {
              if (!inv.user?._id) continue;

              const participant = inv.user;
              if (
                !participant ||
                participant.pushEnabled !== true ||
                participant.pushEvents?.events === false
              )
                continue;

              const pushTimings = participant.pushEventTimings || [1];
              if (pushTimings.includes(reminder.daysBeforeEvent)) {
                await sendPushToUser(
                  participant._id,
                  buildEventPushPayload(event, reminder.daysBeforeEvent),
                );
              }
            }

            reminder.sent = true;
            event.markModified("reminders");
            await event.save();
          }
        }
      }
    }

    console.log("✅ [CRON] Vérification des rappels d'événements terminée");
  } catch (error) {
    console.error(
      "❌ Erreur lors de la vérification des rappels d'événements:",
      error,
    );
  }
}

// ========================================
// PLANIFICATION : Tous les jours à 6h00
// ========================================
const eventCronJob = cron.schedule(
  "0 6 * * *",
  async () => {
    await checkAndSendEventReminders();
  },
  { scheduled: false, timezone: "Europe/Paris" },
);

module.exports = {
  initApp,
  start: () => {
    eventCronJob.start();
    console.log("✅ Rappels des événements planifiés (6h du matin)");
  },
  checkAndSendEventReminders,
};
