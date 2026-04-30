const express = require("express");
const router = express.Router();
const Event = require("../../models/event.model");
const EventInvitation = require("../../models/eventInvitation.model");
const EventGiftProposal = require("../../models/eventGiftProposal.model");
const EventMessage = require("../../models/eventMessage.model");
const { nanoid } = require("nanoid");
const { isAuthenticated } = require("../../middleware/jwt.middleware");
const { notify } = require("../../utils/notify");
const { sendPushToUser } = require("../../services/pushService");

const generateAccessCode = () =>
  Math.random().toString(36).substring(2, 8).toUpperCase();

/*
 * POST /api/events -> créer un événement
 */
router.post("/", isAuthenticated, async (req, res) => {
  try {
    const {
      title,
      description,
      type,
      forPerson,
      forDate,
      recurrence,
      dateMode,
      fixedDate,
      dateOptions,
      locationMode,
      fixedLocation,
      locationOptions,
      giftMode,
      imposedGifts,
      giftPoolEnabled,
      maxGuests,
      allowExternalGuests,
      allowGuestInvites,
      reminders,
      maxGiftProposalsPerUser,
    } = req.body;

    const newEvent = new Event({
      shortId: nanoid(5),
      accessCode: generateAccessCode(),
      title,
      description,
      type,
      organizer: req.payload._id,
      forPerson: forPerson || null,
      forDate: forDate || null,
      recurrence,
      dateMode,
      fixedDate: dateMode === "fixed" ? fixedDate : undefined,
      dateOptions: dateMode === "vote" ? dateOptions : undefined,
      locationMode,
      fixedLocation: locationMode === "fixed" ? fixedLocation : undefined,
      locationOptions: locationMode === "vote" ? locationOptions : undefined,
      giftMode,
      imposedGifts: giftMode === "imposed" ? imposedGifts || [] : [],
      giftPoolEnabled: giftPoolEnabled || false,
      maxGuests: maxGuests || null,
      maxGiftProposalsPerUser: maxGiftProposalsPerUser || null,
      allowExternalGuests: allowExternalGuests !== false,
      allowGuestInvites: allowGuestInvites === true,
      reminders: reminders || [],
      status: "published",
    });

    await newEvent.save();
    res.status(201).json(newEvent);
  } catch (error) {
    console.error("❌ Error creating event:", error);
    res
      .status(500)
      .json({ message: "Erreur lors de la création de l'événement", error });
  }
});

/*
 * GET /api/events/mine (DOIT ÊTRE AVANT /:shortId)
 */
router.get("/mine", isAuthenticated, async (req, res) => {
  try {
    const userId = req.payload._id;
    const organizedEvents = await Event.find({ organizer: userId }).populate(
      "forPerson",
      "name surname",
    );
    const invitations = await EventInvitation.find({ user: userId }).populate({
      path: "event",
      populate: { path: "organizer forPerson", select: "name surname avatar" },
    });
    const invitedEvents = invitations.map((inv) => ({
      ...inv.event.toObject(),
      myRsvpStatus: inv.status,
    }));
    res
      .status(200)
      .json({ organized: organizedEvents, invited: invitedEvents });
  } catch (error) {
    console.error("❌ Error fetching my events:", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

/*
 * GET /api/events/check/:id (DOIT ÊTRE AVANT /:shortId)
 */
router.get("/check/:id", isAuthenticated, async (req, res) => {
  try {
    const event = await Event.findOne({
      $or: [{ forPerson: req.params.id }, { forDate: req.params.id }],
      organizer: req.payload._id,
      status: { $in: ["draft", "published"] },
    }).select("shortId");
    res.status(200).json({ exists: !!event, shortId: event?.shortId });
  } catch (error) {
    console.error("❌ Error checking event existence:", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

/*
 * GET /api/events/:shortId -> récupérer un événement (public/guest view)
 */
router.get("/:shortId", async (req, res) => {
  try {
    const event = await Event.findOne({ shortId: req.params.shortId })
      .populate("organizer", "name surname email avatar publicKey")
      .populate({
        path: "invitations",
        populate: { path: "user", select: "name surname avatar publicKey" },
      })
      .populate("forPerson", "name surname avatar")
      .populate("forDate", "name date");

    if (!event)
      return res.status(404).json({ message: "Événement introuvable" });

    let userId = null;
    if (req.headers.authorization?.split(" ")[0] === "Bearer") {
      try {
        const p = require("jsonwebtoken").verify(
          req.headers.authorization.split(" ")[1],
          process.env.TOKEN_SECRET,
        );
        userId = p._id;
      } catch (_) {}
    } else if (req.cookies?.authToken) {
      try {
        const p = require("jsonwebtoken").verify(
          req.cookies.authToken,
          process.env.TOKEN_SECRET,
        );
        userId = p._id;
      } catch (_) {}
    }

    let hasFullAccess = false;
    let myRsvpStatus = null;

    if (userId) {
      if (event.organizer._id.toString() === userId) {
        hasFullAccess = true;
      } else {
        const inv = await EventInvitation.findOne({
          event: event._id,
          user: userId,
        });
        if (inv) {
          hasFullAccess = true;
          myRsvpStatus = inv.status;
        }
      }
    }

    const guestToken = req.headers["x-guest-token"];
    if (!hasFullAccess && guestToken) {
      const guestInv = await EventInvitation.findOne({
        event: event._id,
        guestToken,
        user: null,
      });
      if (guestInv) {
        hasFullAccess = true;
        myRsvpStatus = guestInv.status;
      }
    }

    const guestCode = req.headers["x-event-code"];
    if (!hasFullAccess && guestCode && guestCode === event.accessCode)
      hasFullAccess = true;

    if (hasFullAccess) {
      return res
        .status(200)
        .json({ ...event.toObject(), hasFullAccess, myRsvpStatus });
    }

    return res.status(200).json({
      shortId: event.shortId,
      title: event.title,
      description: event.description,
      type: event.type,
      status: event.status,
      dateMode: event.dateMode,
      fixedDate: event.fixedDate,
      dateOptions: event.dateOptions,
      locationMode: event.locationMode,
      fixedLocation: event.fixedLocation,
      locationOptions: event.locationOptions,
      organizer: event.organizer,
      forPerson: event.forPerson,
      allowExternalGuests: event.allowExternalGuests,
      hasFullAccess: false,
    });
  } catch (error) {
    console.error("❌ Error fetching event:", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

/*
 * PUT /api/events/:shortId -> modifier (organizer only)
 */
router.put("/:shortId", isAuthenticated, async (req, res) => {
  try {
    const event = await Event.findOne({ shortId: req.params.shortId });
    if (!event)
      return res.status(404).json({ message: "Événement introuvable" });
    if (event.organizer.toString() !== req.payload._id)
      return res.status(403).json({ message: "Non autorisé" });

    const fields = [
      "title",
      "description",
      "type",
      "dateMode",
      "fixedDate",
      "dateOptions",
      "selectedDate",
      "locationMode",
      "fixedLocation",
      "locationOptions",
      "selectedLocation",
      "giftMode",
      "maxGuests",
      "allowExternalGuests",
      "allowGuestInvites",
      "status",
      "maxGiftProposalsPerUser",
    ];

    for (const f of fields) {
      if (req.body[f] !== undefined) {
        if (f === "maxGuests" || f === "maxGiftProposalsPerUser")
          event[f] = req.body[f] || null;
        else if (
          f === "fixedDate" ||
          f === "selectedDate" ||
          f === "fixedLocation" ||
          f === "selectedLocation"
        )
          event[f] = req.body[f] || null;
        else event[f] = req.body[f];
      }
    }

    if (req.body.imposedGifts !== undefined) {
      event.imposedGifts = (req.body.imposedGifts || []).map((g) => ({
        name: g.name || "",
        url: g.url || "",
        price: g.price ? Number(g.price) : undefined,
      }));
    }

    if (req.body.reminders && Array.isArray(req.body.reminders)) {
      event.reminders = req.body.reminders.map((r) => ({
        type: r.type,
        daysBeforeEvent: r.daysBeforeEvent,
        sent: r.sent || false,
      }));
    }

    await event.save();

    // Notifier les invités si l'event a été modifié (hors confirmation de date)
    if (!req.body.selectedDate) {
      const invitations = await EventInvitation.find({
        event: event._id,
        user: { $ne: null },
      });
      for (const inv of invitations) {
        await notify(req.app, {
          userId: inv.user,
          type: "event_reminder",
          data: {
            eventTitle: event.title,
            eventShortId: event.shortId,
            message: "L'événement a été modifié par l'organisateur",
          },
          link: `/event/${event.shortId}`,
        });
        await sendPushToUser(inv.user, {
          title: `✏️ Événement modifié — ${event.title}`,
          body: "L'organisateur a mis à jour les informations",
          url: `/event/${event.shortId}`,
          tag: `event-updated-${event.shortId}`,
          type: "default",
        });
      }
    }

    // Notifier les invités si la date vient d'être confirmée
    if (req.body.selectedDate) {
      const invitations = await EventInvitation.find({
        event: event._id,
        user: { $ne: null },
      });
      for (const inv of invitations) {
        await notify(req.app, {
          userId: inv.user,
          type: "event_reminder",
          data: {
            eventTitle: event.title,
            eventShortId: event.shortId,
            message: "La date de l'événement a été confirmée !",
          },
          link: `/event/${event.shortId}`,
        });
        await sendPushToUser(inv.user, {
          title: `📅 Date confirmée — ${event.title}`,
          body: "La date de l'événement a été fixée !",
          url: `/event/${event.shortId}`,
          tag: `event-date-confirmed-${event.shortId}`,
          type: "default",
        });
      }
    }

    res.status(200).json(event);
  } catch (error) {
    console.error("❌ Error updating event:", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

/*
 * DELETE /api/events/:shortId -> supprimer (organizer only)
 */
router.delete("/:shortId", isAuthenticated, async (req, res) => {
  try {
    const event = await Event.findOne({ shortId: req.params.shortId });
    if (!event)
      return res.status(404).json({ message: "Événement introuvable" });
    if (event.organizer.toString() !== req.payload._id)
      return res.status(403).json({ message: "Non autorisé" });

    await EventInvitation.deleteMany({ event: event._id });
    await EventGiftProposal.deleteMany({ event: event._id });
    await EventMessage.deleteMany({ event: event._id });
    await event.remove();

    res.status(200).json({ message: "Événement supprimé" });
  } catch (error) {
    console.error("❌ Error deleting event:", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

/*
 * GET /api/events/:shortId/share
 */
router.get("/:shortId/share", async (req, res) => {
  try {
    const event = await Event.findOne({ shortId: req.params.shortId });
    if (!event)
      return res.status(404).json({ message: "Événement introuvable" });
    const baseUrl = process.env.FRONTEND_URL || "https://birthreminder.com";
    res.status(200).json({
      url: `${baseUrl}/event/${event.shortId}`,
      code: event.accessCode,
    });
  } catch (error) {
    console.error("❌ Error getting share link:", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

/*
 * GET /api/events/:shortId/messages -> chat fallback HTTP
 */
const { checkGuestOrAuth } = require("../../middleware/checkGuestOrAuth");
router.get("/:shortId/messages", checkGuestOrAuth, async (req, res) => {
  try {
    const messages = await EventMessage.find({ event: req.event._id })
      .populate("sender", "name surname avatar publicKey")
      .sort({ createdAt: 1 });
    res.status(200).json(messages);
  } catch (error) {
    console.error("❌ Error loading messages:", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

/*
 * PUT /api/events/:shortId/notification-prefs -> préférences notifs organisateur
 */
router.put(
  "/:shortId/notification-prefs",
  isAuthenticated,
  async (req, res) => {
    try {
      const event = await Event.findOne({ shortId: req.params.shortId });
      if (!event)
        return res.status(404).json({ message: "Événement introuvable" });
      if (event.organizer.toString() !== req.payload._id)
        return res.status(403).json({ message: "Non autorisé" });

      const { rsvp, dateVote, locationVote, giftProposed, giftVote } = req.body;
      const current = event.organizerNotificationPrefs || {};

      event.organizerNotificationPrefs = {
        rsvp: rsvp !== undefined ? rsvp : (current.rsvp ?? true),
        dateVote:
          dateVote !== undefined ? dateVote : (current.dateVote ?? true),
        locationVote:
          locationVote !== undefined
            ? locationVote
            : (current.locationVote ?? true),
        giftProposed:
          giftProposed !== undefined
            ? giftProposed
            : (current.giftProposed ?? true),
        giftVote:
          giftVote !== undefined ? giftVote : (current.giftVote ?? true),
      };

      await event.save();
      res.status(200).json(event.organizerNotificationPrefs);
    } catch (error) {
      console.error("❌ Error updating notification prefs:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  },
);

module.exports = router;
