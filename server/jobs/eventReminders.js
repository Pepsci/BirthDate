const cron = require("node-cron");
const Event = require("../models/event.model");
const EventInvitation = require("../models/eventInvitation.model");
const User = require("../models/user.model");
const {
  sendEventReminderEmail,
} = require("../services/emailTemplates/eventEmails");
const { sendPushToUser } = require("../services/pushService");

// notify nécessite l'instance app — on la reçoit via initApp()
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
  const title = event.title || "Un événement";

  if (daysFromNow === 0) {
    return {
      title: `🎉 C'est aujourd'hui — ${title} !`,
      body: `L'événement a lieu aujourd'hui, bonne fête !`,
      url: `/event/${event.shortId}`,
      tag: `event-${event._id}-today`,
      type: "event",
    };
  }

  const dayLabel =
    daysFromNow === 1
      ? "demain"
      : daysFromNow === 7
        ? "dans 1 semaine"
        : `dans ${daysFromNow} jours`;

  return {
    title: `🎉 ${title} ${dayLabel}`,
    body: `N'oubliez pas, l'événement approche !`,
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
            const invitations = await EventInvitation.find({
              event: event._id,
              status: { $in: ["accepted", "maybe"] },
            }).populate(
              "user",
              "email _id receiveEventEmails pushEnabled pushEvents pushEventTimings",
            );

            const organizer = await User.findById(event.organizer);

            // ── Emails ──
            const recipients = [];

            if (
              organizer &&
              organizer.email &&
              organizer.receiveEventEmails !== false
            ) {
              recipients.push(organizer.email);
            }

            for (const inv of invitations) {
              if (
                inv.user &&
                inv.user.email &&
                inv.user.receiveEventEmails !== false
              ) {
                recipients.push(inv.user.email);
              }
              // Invités externes : pas de préférence possible, on envoie toujours
              if (inv.externalEmail) recipients.push(inv.externalEmail);
            }

            const uniqueEmails = [...new Set(recipients)];

            for (const email of uniqueEmails) {
              await sendEventReminderEmail(
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
