const express = require("express");
const router = express.Router();
const Event = require("../models/event.model");
const EventInvitation = require("../models/eventInvitation.model");
const EventGiftProposal = require("../models/eventGiftProposal.model");
const EventMessage = require("../models/eventMessage.model");
const User = require("../models/user.model");
const { nanoid } = require("nanoid");
const { isAuthenticated } = require("../middleware/jwt.middleware");
const { checkEventAccess } = require("../middleware/checkEventAccess");
const {
  sendEventInvitationEmail,
} = require("../services/emailTemplates/eventEmails");

// Utils pour générer code accès
const generateAccessCode = () => {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
};

/*
 * 1. POST /api/events -> créer un événement
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
      status,
    } = req.body;

    const shortId = nanoid(5);
    const accessCode = generateAccessCode();

    const newEvent = new Event({
      shortId,
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
      allowExternalGuests: allowExternalGuests !== false,
      allowGuestInvites: allowGuestInvites === true,
      accessCode,
      reminders: reminders || [],
      status: "published", // Publié par défaut à la création
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
 * 2. GET /api/events/mine -> mes événements (organisateur ou invité)
 * DOIT ÊTRE AVANT /api/events/:shortId
 */
router.get("/mine", isAuthenticated, async (req, res) => {
  try {
    const userId = req.payload._id;

    // Événements où je suis organisateur
    const organizedEvents = await Event.find({ organizer: userId }).populate(
      "forPerson",
      "name surname",
    );

    // Événements où je suis invité
    const invitations = await EventInvitation.find({ user: userId }).populate({
      path: "event",
      populate: { path: "organizer forPerson", select: "name surname avatar" },
    });

    const invitedEvents = invitations.map((inv) => ({
      ...inv.event.toObject(),
      myRsvpStatus: inv.status,
    }));

    res.status(200).json({
      organized: organizedEvents,
      invited: invitedEvents,
    });
  } catch (error) {
    console.error("❌ Error fetching my events:", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

/*
 * 2.5 GET /api/events/check/:id -> vérifier si un événement existe déjà pour une personne/date
 * DOIT ÊTRE AVANT /:shortId (sinon "check" est interprété comme un shortId)
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
 * 3. GET /api/events/:shortId -> récupérer un événement (public/guest view)
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

    if (!event) {
      return res.status(404).json({ message: "Événement introuvable" });
    }

    // Identify user manually since route is not protected
    let userId = null;
    if (
      req.headers.authorization &&
      req.headers.authorization.split(" ")[0] === "Bearer"
    ) {
      const token = req.headers.authorization.split(" ")[1];
      try {
        const payload = require("jsonwebtoken").verify(
          token,
          process.env.TOKEN_SECRET,
        );
        userId = payload._id;
      } catch (err) {}
    } else if (req.cookies && req.cookies.authToken) {
      try {
        const payload = require("jsonwebtoken").verify(
          req.cookies.authToken,
          process.env.TOKEN_SECRET,
        );
        userId = payload._id;
      } catch (err) {}
    }

    let hasFullAccess = false;
    let myRsvpStatus = null;

    if (userId) {
      if (event.organizer._id.toString() === userId) {
        hasFullAccess = true;
      } else {
        const invitation = await EventInvitation.findOne({
          event: event._id,
          user: userId,
        });
        if (invitation) {
          hasFullAccess = true;
          myRsvpStatus = invitation.status;
        }
      }
    }

    // Check session code for guests
    const guestCode = req.headers["x-event-code"];
    if (!hasFullAccess && guestCode && guestCode === event.accessCode) {
      hasFullAccess = true;
    }

    if (hasFullAccess) {
      return res
        .status(200)
        .json({ ...event.toObject(), hasFullAccess, myRsvpStatus });
    } else {
      // Return public data only
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
    }
  } catch (error) {
    console.error("❌ Error fetching event:", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

/*
 * 4. PUT /api/events/:shortId -> modifier un événement (organizer only)
 */
router.put("/:shortId", isAuthenticated, async (req, res) => {
  try {
    const event = await Event.findOne({ shortId: req.params.shortId });
    if (!event) {
      return res.status(404).json({ message: "Événement introuvable" });
    }

    if (event.organizer.toString() !== req.payload._id) {
      return res.status(403).json({ message: "Non autorisé" });
    }

    const {
      title,
      description,
      type,
      dateMode,
      fixedDate,
      dateOptions,
      selectedDate,
      locationMode,
      fixedLocation,
      locationOptions,
      selectedLocation,
      giftMode,
      imposedGifts,
      maxGuests,
      allowExternalGuests,
      allowGuestInvites,
      reminders,
      status,
    } = req.body;

    if (title) event.title = title;
    if (description !== undefined) event.description = description;
    if (type) event.type = type;

    if (dateMode) event.dateMode = dateMode;
    if (fixedDate !== undefined) event.fixedDate = fixedDate || null;
    if (dateOptions) event.dateOptions = dateOptions;
    if (selectedDate !== undefined) event.selectedDate = selectedDate;

    if (locationMode) event.locationMode = locationMode;
    if (fixedLocation !== undefined) event.fixedLocation = fixedLocation;
    if (locationOptions) event.locationOptions = locationOptions;
    if (selectedLocation !== undefined)
      event.selectedLocation = selectedLocation;

    if (giftMode) event.giftMode = giftMode;
    if (imposedGifts !== undefined) {
      event.imposedGifts = (imposedGifts || []).map((g) => ({
        name: g.name || "",
        url: g.url || "",
        price: g.price ? Number(g.price) : undefined,
      }));
    }

    if (maxGuests !== undefined) event.maxGuests = maxGuests || null;
    if (allowExternalGuests !== undefined)
      event.allowExternalGuests = allowExternalGuests;
    if (allowGuestInvites !== undefined)
      event.allowGuestInvites = allowGuestInvites;
    if (reminders && Array.isArray(reminders)) {
      event.reminders = reminders.map((r) => ({
        type: r.type,
        daysBeforeEvent: r.daysBeforeEvent,
        sent: r.sent || false,
      }));
    }
    if (status) event.status = status;

    await event.save();
    res.status(200).json(event);
  } catch (error) {
    console.error("❌ Error updating event:", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

/*
 * 17. DELETE /api/events/:shortId/leave -> quitter un événement (invité only)
 */
router.delete("/:shortId/leave", isAuthenticated, async (req, res) => {
  try {
    const event = await Event.findOne({ shortId: req.params.shortId });
    if (!event)
      return res.status(404).json({ message: "Événement introuvable" });

    // Vérifier que l'utilisateur n'est pas l'organisateur
    if (event.organizer.toString() === req.payload._id) {
      return res
        .status(403)
        .json({
          message: "L'organisateur ne peut pas quitter son propre événement",
        });
    }

    // Supprimer l'invitation
    const deleted = await EventInvitation.findOneAndDelete({
      event: event._id,
      user: req.payload._id,
    });

    if (!deleted) {
      return res.status(404).json({ message: "Invitation introuvable" });
    }

    res.status(200).json({ message: "Vous avez quitté l'événement" });
  } catch (error) {
    console.error("❌ Error leaving event:", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

/*
 * 5. DELETE /api/events/:shortId -> annuler un événement (organizer only)
 */
router.delete("/:shortId", isAuthenticated, async (req, res) => {
  try {
    const event = await Event.findOne({ shortId: req.params.shortId });
    if (!event) {
      return res.status(404).json({ message: "Événement introuvable" });
    }

    if (event.organizer.toString() !== req.payload._id) {
      return res.status(403).json({ message: "Non autorisé" });
    }

    // Cascade delete
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
 * 6. POST /api/events/:shortId/invite -> inviter utilisateurs inscrits
 */
router.post("/:shortId/invite", isAuthenticated, async (req, res) => {
  try {
    const event = await Event.findOne({ shortId: req.params.shortId }).populate(
      "organizer",
      "name surname",
    );
    if (!event)
      return res.status(404).json({ message: "Événement introuvable" });
    if (event.organizer._id.toString() !== req.payload._id)
      return res.status(403).json({ message: "Non autorisé" });

    const { userIds, externalEmails } = req.body;
    const baseUrl =
      process.env.NODE_ENV === "production"
        ? "https://birthreminder.com"
        : "http://localhost:5173";
    const eventUrl = `${baseUrl}/event/${event.shortId}`;

    if (userIds && userIds.length > 0) {
      for (const uid of userIds) {
        const existing = await EventInvitation.findOne({
          event: event._id,
          user: uid,
        });
        if (!existing) {
          await EventInvitation.create({ event: event._id, user: uid });

          const targetedUser = await User.findById(uid);
          if (targetedUser) {
            await sendEventInvitationEmail(
              targetedUser.email,
              event,
              event.organizer.name,
              eventUrl,
            );
          }
        }
      }
    }

    if (externalEmails && externalEmails.length > 0) {
      for (const email of externalEmails) {
        const existing = await EventInvitation.findOne({
          event: event._id,
          externalEmail: email,
        });
        if (!existing) {
          await EventInvitation.create({
            event: event._id,
            externalEmail: email,
          });
          await sendEventInvitationEmail(
            email,
            event,
            event.organizer.name,
            eventUrl,
          );
        }
      }
    }

    res.status(200).json({ message: "Invitations envoyées" });
  } catch (error) {
    console.error("❌ Error inviting users:", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

/*
 * 7. POST /api/events/:shortId/join -> rejoindre via code
 */
router.post("/:shortId/join", async (req, res) => {
  try {
    const { code, guestName, externalEmail } = req.body;
    const event = await Event.findOne({ shortId: req.params.shortId });

    if (!event)
      return res.status(404).json({ message: "Événement introuvable" });
    if (event.accessCode !== code)
      return res.status(403).json({ message: "Code d'accès invalide" });

    // Identify user — app uses httpOnly cookie 'authToken', not Authorization header
    let tokenPayload = null;
    const cookieToken = req.cookies && req.cookies.authToken;
    if (cookieToken) {
      try {
        const jwt = require("jsonwebtoken");
        tokenPayload = jwt.verify(cookieToken, process.env.TOKEN_SECRET);
      } catch (err) {
        // Not authenticated or expired
      }
    }

    // Check if limits reached
    if (event.maxGuests !== null) {
      const currentGuests = await EventInvitation.countDocuments({
        event: event._id,
        status: { $in: ["accepted", "maybe"] },
      });
      if (currentGuests >= event.maxGuests) {
        return res.status(400).json({ message: "L'événement est complet" });
      }
    }

    let invitation;
    if (tokenPayload) {
      invitation = await EventInvitation.findOne({
        event: event._id,
        user: tokenPayload._id,
      });
      if (!invitation) {
        invitation = await EventInvitation.create({
          event: event._id,
          user: tokenPayload._id,
          joinedViaCode: true,
          status: "accepted",
        });
      }
    } else {
      if (!event.allowExternalGuests)
        return res
          .status(403)
          .json({ message: "Les invités externes ne sont pas autorisés." });
      // If we don't have guestName, it's just a session unlock, don't create an invitation yet.
      if (!guestName) {
        return res
          .status(200)
          .json({ message: "Code valide, accès accordé", unlockSession: true });
      }

      invitation = await EventInvitation.findOne({
        event: event._id,
        externalEmail,
        guestName,
      });
      if (!invitation) {
        invitation = await EventInvitation.create({
          event: event._id,
          externalEmail,
          guestName,
          joinedViaCode: true,
          status: "accepted",
        });
      }
    }

    res.status(200).json({ message: "Rejoint avec succès", invitation });
  } catch (error) {
    console.error("❌ Error joining event:", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

/*
 * 8. PUT /api/events/:shortId/rsvp -> répondre invitation
 */
router.put(
  "/:shortId/rsvp",
  isAuthenticated,
  checkEventAccess,
  async (req, res) => {
    try {
      const { status } = req.body;
      // req.event et req.invitation sont fournis par le middleware
      if (req.userRole === "organizer") {
        return res
          .status(400)
          .json({
            message:
              "L'organisateur ne peut pas modifier son RSVP via cette route.",
          });
      }

      const invitation = req.invitation;
      invitation.status = status;
      await invitation.save();

      res.status(200).json(invitation);
    } catch (error) {
      console.error("❌ Error setting RSVP:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  },
);

/*
 * 9. POST /api/events/:shortId/vote/date -> vote date
 */
router.post(
  "/:shortId/vote/date",
  isAuthenticated,
  checkEventAccess,
  async (req, res) => {
    try {
      const { dates } = req.body;

      if (req.userRole === "organizer") {
        return res
          .status(400)
          .json({ message: "L'organisateur ne vote pas via cette route." });
      }

      const invitation = req.invitation;
      invitation.dateVote = dates;
      await invitation.save();

      res
        .status(200)
        .json({ message: "Votes enregistrés", dateVote: invitation.dateVote });
    } catch (error) {
      console.error("❌ Error voting for date:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  },
);

/*
 * 10. POST /api/events/:shortId/vote/location -> vote lieu
 */
router.post(
  "/:shortId/vote/location",
  isAuthenticated,
  checkEventAccess,
  async (req, res) => {
    try {
      const { locationId } = req.body;

      if (req.userRole === "organizer") {
        return res
          .status(400)
          .json({ message: "L'organisateur ne vote pas via cette route." });
      }

      const invitation = req.invitation;
      invitation.locationVote = locationId;
      await invitation.save();

      res
        .status(200)
        .json({
          message: "Vote enregistré",
          locationVote: invitation.locationVote,
        });
    } catch (error) {
      console.error("❌ Error voting for location:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  },
);

/*
 * 11. POST /api/events/:shortId/gifts -> proposer un cadeau
 */
router.post(
  "/:shortId/gifts",
  isAuthenticated,
  checkEventAccess,
  async (req, res) => {
    try {
      const { name, url, price } = req.body;
      const event = req.event;

      const newProposal = await EventGiftProposal.create({
        event: event._id,
        proposedBy: req.payload._id,
        name,
        url,
        price,
      });

      res.status(201).json(newProposal);
    } catch (error) {
      console.error("❌ Error creating gift proposal:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  },
);

/*
 * 12. GET /api/events/:shortId/gifts -> lister les propositions de cadeaux
 */
router.get(
  "/:shortId/gifts",
  isAuthenticated,
  checkEventAccess,
  async (req, res) => {
    try {
      const event = req.event;

      const proposals = await EventGiftProposal.find({
        event: event._id,
      }).populate("proposedBy", "name surname");
      res.status(200).json(proposals);
    } catch (error) {
      console.error("❌ Error loading gift proposals:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  },
);

/*
 * 13. POST /api/events/:shortId/gifts/:giftId/vote -> vote cadeau
 */
router.post(
  "/:shortId/gifts/:giftId/vote",
  isAuthenticated,
  checkEventAccess,
  async (req, res) => {
    try {
      const proposal = await EventGiftProposal.findById(req.params.giftId);
      if (!proposal)
        return res.status(404).json({ message: "Proposition introuvable" });

      const userId = req.payload._id;
      const hasVoted = proposal.votes.includes(userId);

      if (hasVoted) {
        proposal.votes = proposal.votes.filter(
          (id) => id.toString() !== userId,
        );
      } else {
        proposal.votes.push(userId);
      }

      await proposal.save();
      res.status(200).json(proposal);
    } catch (error) {
      console.error("❌ Error voting for gift:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  },
);

/*
 * 14. PUT /api/events/:shortId/gifts/:giftId -> modifier une proposition de cadeau (proposeur only)
 */
router.put(
  "/:shortId/gifts/:giftId",
  isAuthenticated,
  checkEventAccess,
  async (req, res) => {
    try {
      const proposal = await EventGiftProposal.findById(req.params.giftId);
      if (!proposal)
        return res.status(404).json({ message: "Proposition introuvable" });
      if (proposal.proposedBy.toString() !== req.payload._id) {
        return res.status(403).json({ message: "Non autorisé" });
      }
      const { name, url, price } = req.body;
      if (name) proposal.name = name;
      if (url !== undefined) proposal.url = url;
      if (price !== undefined)
        proposal.price = price ? Number(price) : undefined;
      await proposal.save();
      res.status(200).json(proposal);
    } catch (error) {
      console.error("❌ Error updating gift proposal:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  },
);

/*
 * 15. GET /api/events/:shortId/messages -> chat (fallback HTTP)
 */
router.get(
  "/:shortId/messages",
  isAuthenticated,
  checkEventAccess,
  async (req, res) => {
    try {
      const event = req.event;

      const messages = await EventMessage.find({ event: event._id })
        .populate("sender", "name surname avatar publicKey")
        .sort({ createdAt: 1 });

      res.status(200).json(messages);
    } catch (error) {
      console.error("❌ Error loading messages:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  },
);

/*
 * 15. GET /api/events/:shortId/share -> générer/retourner { url, code }
 */
router.get("/:shortId/share", async (req, res) => {
  try {
    const event = await Event.findOne({ shortId: req.params.shortId });
    if (!event)
      return res.status(404).json({ message: "Événement introuvable" });

    const baseUrl =
      process.env.NODE_ENV === "production"
        ? "https://birthreminder.com"
        : "http://localhost:5173";

    res.status(200).json({
      url: `${baseUrl}/event/${event.shortId}`,
      code: event.accessCode,
    });
  } catch (error) {
    console.error("❌ Error getting share link:", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

/* 16. GET /api/events/:shortId/invitations -> liste des invitations peuplées */
router.get(
  "/:shortId/invitations",
  isAuthenticated,
  checkEventAccess,
  async (req, res) => {
    try {
      const invitations = await EventInvitation.find({ event: req.event._id })
        .populate("user", "name surname avatar publicKey")
        .sort({ createdAt: 1 });

      res.status(200).json(invitations);
    } catch (error) {
      console.error("❌ Error fetching invitations:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  },
);

module.exports = router;
