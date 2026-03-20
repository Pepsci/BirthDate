const cron = require("node-cron");
const Event = require("../models/event.model");
const EventInvitation = require("../models/eventInvitation.model");
const User = require("../models/user.model");
const { sendEventReminderEmail } = require("../services/emailTemplates/eventEmails");

const frontendUrl = process.env.FRONTEND_URL || (process.env.NODE_ENV === "production" ? "https://birthreminder.com" : "http://localhost:5173");

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

async function checkAndSendEventReminders() {
  try {
    console.log("📅 [CRON] Vérification des rappels d'événements...");

    // Find active events with fixed dates or selected dates
    const events = await Event.find({ 
      status: "published",
      $or: [
        { dateMode: "fixed", fixedDate: { $ne: null } },
        { dateMode: "vote", selectedDate: { $ne: null } }
      ]
    });

    for (const event of events) {
      const eventDate = event.dateMode === "fixed" ? event.fixedDate : event.selectedDate;
      const url = `${frontendUrl}/event/${event.shortId}`;

      // Check configured reminders for the event
      if (event.reminders && event.reminders.length > 0) {
        for (let i = 0; i < event.reminders.length; i++) {
          const reminder = event.reminders[i];

          // If it's a date reminder and hasn't been sent
          if (reminder.type === "event_date" && !reminder.sent) {
            if (isEventInXDays(eventDate, reminder.daysBeforeEvent)) {
              console.log(`⏳ Envoi du rappel J-${reminder.daysBeforeEvent} pour l'événement ${event.title}`);
              
              // Get all accepted/maybe guests and organizer
              const invitations = await EventInvitation.find({ 
                event: event._id,
                status: { $in: ["accepted", "maybe"] } 
              }).populate("user", "email");

              const recipients = [];
              const organizer = await User.findById(event.organizer);
              if (organizer && organizer.email) recipients.push(organizer.email);

              for (const inv of invitations) {
                if (inv.user && inv.user.email) recipients.push(inv.user.email);
                if (inv.externalEmail) recipients.push(inv.externalEmail);
              }

              // Send unique emails
              const uniqueEmails = [...new Set(recipients)];
              
              for (const email of uniqueEmails) {
                await sendEventReminderEmail(email, event, reminder.daysBeforeEvent, url);
              }

              // Mark reminder as sent
              reminder.sent = true;
              event.markModified('reminders');
              await event.save();
            }
          }
        }
      }
    }
    console.log("✅ [CRON] Vérification des rappels d'événements terminée");
  } catch (error) {
    console.error("❌ Erreur lors de la vérification des rappels d'événements:", error);
  }
}

// ========================================
// PLANIFICATION : Tous les jours à 6h00 du matin
// ========================================
const eventCronJob = cron.schedule(
  "0 6 * * *",
  async () => {
    await checkAndSendEventReminders();
  },
  { scheduled: false, timezone: "Europe/Paris" }
);

module.exports = {
  start: () => {
    eventCronJob.start();
    console.log("✅ Rappels des événements planifiés (6h du matin)");
  },
  checkAndSendEventReminders
};
