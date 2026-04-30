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
const { checkGuestOrAuth } = require("../middleware/checkGuestOrAuth");
const { notify } = require("../utils/notify");
const {
  sendEventInvitationEmail,
} = require("../services/emailTemplates/eventEmails");

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
 * 2. GET /api/events/mine (DOIT ÊTRE AVANT /:shortId)
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
 * 2.5 GET /api/events/check/:id (DOIT ÊTRE AVANT /:shortId)
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

    if (!event)
      return res.status(404).json({ message: "Événement introuvable" });

    let userId = null;
    if (req.headers.authorization?.split(" ")[0] === "Bearer") {
      try {
        const payload = require("jsonwebtoken").verify(
          req.headers.authorization.split(" ")[1],
          process.env.TOKEN_SECRET,
        );
        userId = payload._id;
      } catch (err) {}
    } else if (req.cookies?.authToken) {
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

    const guestToken = req.headers["x-guest-token"];
    if (!hasFullAccess && guestToken) {
      const guestInvitation = await EventInvitation.findOne({
        event: event._id,
        guestToken,
        user: null,
      });
      if (guestInvitation) {
        hasFullAccess = true;
        myRsvpStatus = guestInvitation.status;
      }
    }

    const guestCode = req.headers["x-event-code"];
    if (!hasFullAccess && guestCode && guestCode === event.accessCode) {
      hasFullAccess = true;
    }

    if (hasFullAccess) {
      return res
        .status(200)
        .json({ ...event.toObject(), hasFullAccess, myRsvpStatus });
    } else {
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
 * 4. PUT /api/events/:shortId -> modifier (organizer only)
 */
router.put("/:shortId", isAuthenticated, async (req, res) => {
  try {
    const event = await Event.findOne({ shortId: req.params.shortId });
    if (!event)
      return res.status(404).json({ message: "Événement introuvable" });
    if (event.organizer.toString() !== req.payload._id)
      return res.status(403).json({ message: "Non autorisé" });

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
 * 5. DELETE /api/events/:shortId/leave -> quitter (invité only)
 */
router.delete("/:shortId/leave", isAuthenticated, async (req, res) => {
  try {
    const event = await Event.findOne({ shortId: req.params.shortId });
    if (!event)
      return res.status(404).json({ message: "Événement introuvable" });

    if (event.organizer.toString() === req.payload._id) {
      return res.status(403).json({
        message: "L'organisateur ne peut pas quitter son propre événement",
      });
    }

    const deleted = await EventInvitation.findOneAndDelete({
      event: event._id,
      user: req.payload._id,
    });

    if (!deleted)
      return res.status(404).json({ message: "Invitation introuvable" });

    res.status(200).json({ message: "Vous avez quitté l'événement" });
  } catch (error) {
    console.error("❌ Error leaving event:", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

/*
 * 6. DELETE /api/events/:shortId -> supprimer (organizer only)
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
 * 7. POST /api/events/:shortId/invite -> inviter des utilisateurs inscrits
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
    const baseUrl = process.env.FRONTEND_URL || "https://birthreminder.com";
    const eventUrl = `${baseUrl}/event/${event.shortId}`;

    if (userIds?.length > 0) {
      for (const uid of userIds) {
        const existing = await EventInvitation.findOne({
          event: event._id,
          user: uid,
        });
        if (!existing) {
          await EventInvitation.create({ event: event._id, user: uid });

          // Notification in-app
          await notify(req.app, {
            userId: uid,
            type: "event_reminder",
            data: {
              eventTitle: event.title,
              eventShortId: event.shortId,
              organizerName:
                `${event.organizer.name} ${event.organizer.surname || ""}`.trim(),
            },
            link: `/event/${event.shortId}`,
          });

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

    if (externalEmails?.length > 0) {
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
 * 8. POST /api/events/:shortId/join -> rejoindre via code
 */
router.post("/:shortId/join", async (req, res) => {
  try {
    const { code, guestName, externalEmail } = req.body;
    const event = await Event.findOne({ shortId: req.params.shortId });

    if (!event)
      return res.status(404).json({ message: "Événement introuvable" });
    if (event.accessCode !== code)
      return res.status(403).json({ message: "Code d'accès invalide" });

    let tokenPayload = null;
    const cookieToken = req.cookies?.authToken;
    if (cookieToken) {
      try {
        tokenPayload = require("jsonwebtoken").verify(
          cookieToken,
          process.env.TOKEN_SECRET,
        );
      } catch (err) {}
    }

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
      return res
        .status(200)
        .json({ message: "Rejoint avec succès", invitation });
    } else {
      if (!event.allowExternalGuests)
        return res
          .status(403)
          .json({ message: "Les invités externes ne sont pas autorisés." });

      if (!guestName) {
        return res
          .status(200)
          .json({ message: "Code valide, accès accordé", unlockSession: true });
      }

      invitation = await EventInvitation.findOne({
        event: event._id,
        guestName,
        externalEmail: externalEmail || null,
        user: null,
      });

      if (!invitation) {
        const guestToken = nanoid(32);
        invitation = await EventInvitation.create({
          event: event._id,
          externalEmail: externalEmail || null,
          guestName,
          joinedViaCode: true,
          status: "accepted",
          guestToken,
        });
      }

      return res.status(200).json({
        message: "Rejoint avec succès",
        invitation,
        guestToken: invitation.guestToken,
      });
    }
  } catch (error) {
    console.error("❌ Error joining event:", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

/*
 * 9. PUT /api/events/:shortId/rsvp -> répondre invitation
 */
router.put("/:shortId/rsvp", checkGuestOrAuth, async (req, res) => {
  try {
    const { status } = req.body;
    if (req.userRole === "organizer") {
      return res.status(400).json({
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
});

/*
 * 10. POST /api/events/:shortId/vote/date -> vote date
 */
router.post("/:shortId/vote/date", checkGuestOrAuth, async (req, res) => {
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
});

/*
 * 11. POST /api/events/:shortId/vote/location -> vote lieu
 */
router.post("/:shortId/vote/location", checkGuestOrAuth, async (req, res) => {
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
    res.status(200).json({
      message: "Vote enregistré",
      locationVote: invitation.locationVote,
    });
  } catch (error) {
    console.error("❌ Error voting for location:", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

/*
 * 12. POST /api/events/:shortId/gifts -> proposer un cadeau
 */
router.post("/:shortId/gifts", checkGuestOrAuth, async (req, res) => {
  try {
    const { name, url, price } = req.body;
    const event = req.event;

    // Vérifier la limite de propositions par user
    if (event.maxGiftProposalsPerUser) {
      const count = await EventGiftProposal.countDocuments({
        event: event._id,
        ...(req.payload?._id
          ? { proposedBy: req.payload._id }
          : { guestName: req.guestName }),
      });
      if (count >= event.maxGiftProposalsPerUser) {
        return res.status(400).json({
          message: `Vous ne pouvez pas proposer plus de ${event.maxGiftProposalsPerUser} cadeau(x).`,
        });
      }
    }

    const newProposal = await EventGiftProposal.create({
      event: event._id,
      proposedBy: req.payload?._id || null,
      guestName: req.guestName || null,
      name,
      url,
      price,
    });
    res.status(201).json(newProposal);
  } catch (error) {
    console.error("❌ Error creating gift proposal:", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

/*
 * 13. GET /api/events/:shortId/gifts -> lister les propositions
 */
router.get("/:shortId/gifts", checkGuestOrAuth, async (req, res) => {
  try {
    const proposals = await EventGiftProposal.find({
      event: req.event._id,
    }).populate("proposedBy", "name surname");
    res.status(200).json(proposals);
  } catch (error) {
    console.error("❌ Error loading gift proposals:", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

/*
 * 14. POST /api/events/:shortId/gifts/:giftId/vote -> voter pour un cadeau
 */
router.post(
  "/:shortId/gifts/:giftId/vote",
  checkGuestOrAuth,
  async (req, res) => {
    try {
      const proposal = await EventGiftProposal.findById(req.params.giftId);
      if (!proposal)
        return res.status(404).json({ message: "Proposition introuvable" });

      const userId = req.payload?._id;
      const guestToken = req.headers["x-guest-token"];

      if (userId) {
        const hasVoted = proposal.votes
          .map((v) => v.toString())
          .includes(userId);
        if (hasVoted) {
          proposal.votes = proposal.votes.filter(
            (id) => id.toString() !== userId,
          );
        } else {
          proposal.votes.push(userId);
        }
      } else if (guestToken) {
        const hasVoted = proposal.guestVotes.includes(guestToken);
        if (hasVoted) {
          proposal.guestVotes = proposal.guestVotes.filter(
            (t) => t !== guestToken,
          );
        } else {
          proposal.guestVotes.push(guestToken);
        }
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
 * 15. PUT /api/events/:shortId/gifts/:giftId -> modifier une proposition
 */
router.put("/:shortId/gifts/:giftId", checkGuestOrAuth, async (req, res) => {
  try {
    const proposal = await EventGiftProposal.findById(req.params.giftId);
    if (!proposal)
      return res.status(404).json({ message: "Proposition introuvable" });

    const isOwner =
      (req.payload?._id &&
        proposal.proposedBy?.toString() === req.payload._id) ||
      (req.guestName && proposal.guestName === req.guestName);

    if (!isOwner) return res.status(403).json({ message: "Non autorisé" });

    const { name, url, price } = req.body;
    if (name) proposal.name = name;
    if (url !== undefined) proposal.url = url;
    if (price !== undefined) proposal.price = price ? Number(price) : undefined;
    await proposal.save();
    res.status(200).json(proposal);
  } catch (error) {
    console.error("❌ Error updating gift proposal:", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

router.post("/:shortId/gifts", checkGuestOrAuth, async (req, res) => {
  try {
    const { name, url, price } = req.body;
    const event = req.event;

    // Vérifier la limite de propositions par user
    if (event.maxGiftProposalsPerUser) {
      const count = await EventGiftProposal.countDocuments({
        event: event._id,
        ...(req.payload?._id
          ? { proposedBy: req.payload._id }
          : { guestName: req.guestName }),
      });
      if (count >= event.maxGiftProposalsPerUser) {
        return res.status(400).json({
          message: `Vous ne pouvez pas proposer plus de ${event.maxGiftProposalsPerUser} cadeau(x).`,
        });
      }
    }

    const newProposal = await EventGiftProposal.create({
      event: event._id,
      proposedBy: req.payload?._id || null,
      guestName: req.guestName || null,
      name,
      url,
      price,
    });
    res.status(201).json(newProposal);
  } catch (error) {
    console.error("❌ Error creating gift proposal:", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

router.delete("/:shortId/gifts/:giftId", checkGuestOrAuth, async (req, res) => {
  try {
    const proposal = await EventGiftProposal.findById(req.params.giftId);
    if (!proposal)
      return res.status(404).json({ message: "Proposition introuvable" });

    const isOwner =
      (req.payload?._id &&
        proposal.proposedBy?.toString() === req.payload._id) ||
      (req.guestName && proposal.guestName === req.guestName);
    const isOrganizer = req.userRole === "organizer";

    if (!isOwner && !isOrganizer) {
      return res.status(403).json({ message: "Non autorisé" });
    }

    await proposal.deleteOne();
    res.status(200).json({ message: "Proposition supprimée" });
  } catch (error) {
    console.error("❌ Error deleting gift proposal:", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

/*
 * 16. GET /api/events/:shortId/messages -> chat fallback HTTP
 */
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
 * 17. GET /api/events/:shortId/share
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
 * 18. GET /api/events/:shortId/invitations
 */
router.get("/:shortId/invitations", checkGuestOrAuth, async (req, res) => {
  try {
    const invitations = await EventInvitation.find({ event: req.event._id })
      .populate("user", "name surname avatar publicKey")
      .sort({ createdAt: 1 });
    res.status(200).json(invitations);
  } catch (error) {
    console.error("❌ Error fetching invitations:", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

/*
 * 19. DELETE /api/events/:shortId/invitations/:invitationId -> retirer un invité (organizer only)
 */
router.delete(
  "/:shortId/invitations/:invitationId",
  isAuthenticated,
  async (req, res) => {
    try {
      const event = await Event.findOne({ shortId: req.params.shortId });
      if (!event)
        return res.status(404).json({ message: "Événement introuvable" });
      if (event.organizer.toString() !== req.payload._id)
        return res.status(403).json({ message: "Non autorisé" });

      const invitation = await EventInvitation.findById(
        req.params.invitationId,
      );
      if (!invitation)
        return res.status(404).json({ message: "Invitation introuvable" });
      if (invitation.event.toString() !== event._id.toString())
        return res.status(403).json({
          message: "Cette invitation n'appartient pas à cet événement",
        });

      await invitation.deleteOne();
      res.status(200).json({ message: "Invité retiré" });
    } catch (error) {
      console.error("❌ Error removing invitation:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  },
);

module.exports = router;
