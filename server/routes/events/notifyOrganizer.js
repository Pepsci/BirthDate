const User = require("../../models/user.model");
const EventInvitation = require("../../models/eventInvitation.model");
const { notify } = require("../../utils/notify");
const { sendPushToUser } = require("../../services/pushService");

/**
 * Notifie l'organisateur d'un event si ses préférences le permettent.
 * @param {Express.Application} app
 * @param {Object} opts
 * @param {Object} opts.event         - Document Event (doit avoir organizer)
 * @param {string} opts.type          - Type de notification
 * @param {Object} opts.data          - Données contextuelles
 * @param {string} opts.link          - Lien de navigation
 * @param {Object} opts.pushPayload   - Payload push (optionnel)
 */
async function notifyOrganizer(app, { event, type, data, link, pushPayload }) {
  try {
    const organizer = await User.findById(event.organizer);
    if (!organizer) return;

    // Vérifie les préférences de l'organisateur pour cet event
    const orgInvitation = await EventInvitation.findOne({
      event: event._id,
      user: organizer._id,
    });

    const prefKey = {
      event_rsvp: "rsvp",
      event_date_vote: "dateVote",
      event_location_vote: "locationVote",
      event_gift_proposed: "giftProposed",
      event_gift_vote: "giftVote",
    }[type];

    if (prefKey && event.organizerNotificationPrefs?.[prefKey] === false) {
      return;
    }

    await notify(app, { userId: organizer._id, type, data, link });

    if (organizer.pushEnabled && pushPayload) {
      await sendPushToUser(organizer._id, pushPayload);
    }
  } catch (err) {
    console.error("❌ notifyOrganizer error:", err);
  }
}

module.exports = { notifyOrganizer };
