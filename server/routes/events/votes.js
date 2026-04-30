const express = require("express");
const router = express.Router();
const User = require("../../models/user.model");
const EventInvitation = require("../../models/eventInvitation.model");
const { checkGuestOrAuth } = require("../../middleware/checkGuestOrAuth");
const { notifyOrganizer } = require("./notifyOrganizer");

/*
 * PUT /api/events/:shortId/rsvp -> répondre invitation
 */
router.put("/:shortId/rsvp", checkGuestOrAuth, async (req, res) => {
  try {
    const { status } = req.body;
    if (req.userRole === "organizer") return res.status(400).json({ message: "L'organisateur ne peut pas modifier son RSVP via cette route." });

    const invitation = req.invitation;
    invitation.status = status;
    await invitation.save();

    const guestName = invitation.guestName || (await User.findById(invitation.user))?.name || "Un invité";
    const statusLabel = { accepted: "sera présent(e)", declined: "ne sera pas présent(e)", maybe: "est peut-être présent(e)" }[status] || status;

    await notifyOrganizer(req.app, {
      event: req.event,
      type: "event_rsvp",
      data: { eventTitle: req.event.title, eventShortId: req.event.shortId, guestName, status },
      link: `/event/${req.event.shortId}`,
      pushPayload: {
        title: `🎉 RSVP — ${req.event.title}`,
        body: `${guestName} ${statusLabel}`,
        url: `/event/${req.event.shortId}`,
        tag: `event-rsvp-${req.event.shortId}`,
        type: "default",
      },
    });

    res.status(200).json(invitation);
  } catch (error) {
    console.error("❌ Error setting RSVP:", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

/*
 * POST /api/events/:shortId/vote/date -> vote date
 */
router.post("/:shortId/vote/date", checkGuestOrAuth, async (req, res) => {
  try {
    const { dates } = req.body;
    if (req.userRole === "organizer") return res.status(400).json({ message: "L'organisateur ne vote pas via cette route." });

    const invitation = req.invitation;
    invitation.dateVote = dates;
    await invitation.save();

    const guestName = invitation.guestName || (await User.findById(invitation.user))?.name || "Un invité";

    await notifyOrganizer(req.app, {
      event: req.event,
      type: "event_date_vote",
      data: { eventTitle: req.event.title, eventShortId: req.event.shortId, guestName },
      link: `/event/${req.event.shortId}`,
      pushPayload: {
        title: `📅 Vote date — ${req.event.title}`,
        body: `${guestName} a voté pour une date`,
        url: `/event/${req.event.shortId}`,
        tag: `event-date-vote-${req.event.shortId}`,
        type: "default",
      },
    });

    res.status(200).json({ message: "Votes enregistrés", dateVote: invitation.dateVote });
  } catch (error) {
    console.error("❌ Error voting for date:", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

/*
 * POST /api/events/:shortId/vote/location -> vote lieu
 */
router.post("/:shortId/vote/location", checkGuestOrAuth, async (req, res) => {
  try {
    const { locationId } = req.body;
    if (req.userRole === "organizer") return res.status(400).json({ message: "L'organisateur ne vote pas via cette route." });

    const invitation = req.invitation;
    invitation.locationVote = locationId;
    await invitation.save();

    const guestName = invitation.guestName || (await User.findById(invitation.user))?.name || "Un invité";

    await notifyOrganizer(req.app, {
      event: req.event,
      type: "event_location_vote",
      data: { eventTitle: req.event.title, eventShortId: req.event.shortId, guestName },
      link: `/event/${req.event.shortId}`,
      pushPayload: {
        title: `📍 Vote lieu — ${req.event.title}`,
        body: `${guestName} a voté pour un lieu`,
        url: `/event/${req.event.shortId}`,
        tag: `event-location-vote-${req.event.shortId}`,
        type: "default",
      },
    });

    res.status(200).json({ message: "Vote enregistré", locationVote: invitation.locationVote });
  } catch (error) {
    console.error("❌ Error voting for location:", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

module.exports = router;
