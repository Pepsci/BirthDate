const express = require("express");
const router = express.Router();
const Event = require("../../models/event.model");
const EventInvitation = require("../../models/eventInvitation.model");
const EventGiftProposal = require("../../models/eventGiftProposal.model");
const EventMessage = require("../../models/eventMessage.model");
const crypto = require("crypto");
const { nanoid } = require("nanoid");
const { isAuthenticated } = require("../../middleware/jwt.middleware");
const { notify } = require("../../utils/notify");
const { sendPushToUser } = require("../../services/pushService");
const {
  sendEventDateChangedEmail,
} = require("../../services/emailTemplates/eventEmails");

// Code d'accès cryptographiquement sûr (8 caractères hex majuscules)
const generateAccessCode = () =>
  crypto.randomBytes(4).toString("hex").toUpperCase();

/**
 * Date à laquelle l'événement a réellement lieu.
 * `selectedDate` (issue d'un vote tranché) prime sur `fixedDate` : c'est celle
 * qui s'affiche aux invités une fois le vote clos.
 * @returns {number|null} timestamp, ou null si aucune date n'est encore fixée
 */
function eventEffectiveDate(event) {
  const d = event.selectedDate || event.fixedDate;
  if (!d) return null;
  const t = new Date(d).getTime();
  return Number.isNaN(t) ? null : t;
}

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
      status,
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
      // Le client peut demander explicitement un brouillon (formulaire quitté
      // avant la fin) ; tout autre valeur reste une publication normale, pour
      // ne pas laisser un appel malformé créer un événement invisible.
      status: status === "draft" ? "draft" : "published",
    });

    await newEvent.save();

    // L'organisateur est un participant : il vient à son propre événement.
    // Sans cette invitation, il n'apparaissait pas dans la liste des
    // participants et le décompte "X / Y" excluait l'hôte — un dîner à 4 dont
    // l'organisateur s'affichait "3 / 3". Statut "accepted" d'emblée : on ne
    // demande pas à quelqu'un de RSVP à sa propre soirée.
    // `findOneAndUpdate` + upsert plutôt que create : idempotent si la route
    // est rejouée, et l'index { event, user } reste cohérent.
    await EventInvitation.findOneAndUpdate(
      { event: newEvent._id, user: req.payload._id },
      {
        $setOnInsert: {
          event: newEvent._id,
          user: req.payload._id,
          status: "accepted",
        },
      },
      { upsert: true, new: true },
    );

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
    const organizedIds = new Set(
      organizedEvents.map((e) => e._id.toString()),
    );
    const invitedEvents = invitations
      // L'organisateur a désormais sa propre EventInvitation (il compte parmi
      // les participants). Il ne doit pas pour autant retrouver ses événements
      // dans "invited" : ils seraient affichés en double dans l'app.
      // Le `!inv.event` filtre au passage les invitations orphelines.
      .filter((inv) => inv.event && !organizedIds.has(inv.event._id.toString()))
      .map((inv) => ({
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
      // Vue publique : on n'expose PAS l'email ni la clé publique de l'organisateur
      organizer: event.organizer
        ? {
            _id: event.organizer._id,
            name: event.organizer.name,
            surname: event.organizer.surname,
            avatar: event.organizer.avatar,
          }
        : null,
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

    // Date effective AVANT modification : c'est elle qui sert de référence pour
    // détecter un vrai changement de date (et donc réinitialiser les RSVP).
    // On la lit ici, avant que les champs soient écrasés plus bas.
    const dateBefore = eventEffectiveDate(event);

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

    const dateAfter = eventEffectiveDate(event);
    // Vrai changement de date : la date effective existe et diffère de l'ancienne.
    // Passer de "aucune date" à une date (confirmation d'un vote) compte aussi :
    // les invités avaient répondu sans savoir quand, leur réponse est caduque.
    const dateChanged = dateAfter !== null && dateAfter !== dateBefore;

    // Invités inscrits, hors organisateur : il ne se notifie pas lui-même de
    // ses propres modifications, et sa présence n'est jamais remise en cause.
    const invitations = await EventInvitation.find({
      event: event._id,
      user: { $ne: null, $nin: [event.organizer] },
    });

    if (dateChanged) {
      // ── La date a bougé : les présences confirmées ne valent plus ──────────
      // Quelqu'un qui avait dit oui pour un samedi n'a pas dit oui pour le
      // mardi suivant. On repasse tout le monde en "pending" pour forcer une
      // reconfirmation explicite, plutôt que de laisser l'organisateur
      // travailler sur un décompte de participants faux.
      await EventInvitation.updateMany(
        {
          event: event._id,
          user: { $nin: [event.organizer] },
          status: { $ne: "pending" },
        },
        { $set: { status: "pending" } },
      );

      // Année incluse : un événement peut être déplacé au-delà du 31 décembre,
      // et "samedi 10 janvier" tout seul serait ambigu.
      const dateLabel = new Date(dateAfter).toLocaleDateString("fr-FR", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      });

      // ── Invités externes : email, seul canal dont ils disposent ───────────
      // Pas de compte → ni notif in-app ni push. Sans cet email leur RSVP est
      // remis à zéro en silence. On ne peut joindre que ceux dont on a l'email
      // (un invité arrivé par code sans en laisser un reste injoignable).
      const externalInvitations = await EventInvitation.find({
        event: event._id,
        user: null,
        externalEmail: { $ne: null, $exists: true },
      });
      const eventUrl = `${process.env.FRONTEND_URL || "https://birthreminder.com"}/event/${event.shortId}`;
      const seenEmails = new Set();
      for (const inv of externalInvitations) {
        const to = (inv.externalEmail || "").trim().toLowerCase();
        // Un même email peut avoir plusieurs invitations (rejoint via code
        // puis invité nommément) : un seul message part.
        if (!to || seenEmails.has(to)) continue;
        seenEmails.add(to);
        try {
          await sendEventDateChangedEmail(
            inv.externalEmail,
            event,
            dateLabel,
            eventUrl,
            event.accessCode,
          );
        } catch (mailErr) {
          // Un email en échec ne doit pas faire échouer la modification de
          // l'événement, déjà enregistrée en base à ce stade.
          console.error(
            `❌ Email "date modifiée" non envoyé à ${inv.externalEmail}:`,
            mailErr.message,
          );
        }
      }

      for (const inv of invitations) {
        await notify(req.app, {
          userId: inv.user,
          type: "event_date_changed",
          data: {
            eventTitle: event.title,
            eventShortId: event.shortId,
            newDate: new Date(dateAfter).toISOString(),
            newDateLabel: dateLabel,
            message: `Nouvelle date : ${dateLabel}. Confirme ta présence.`,
          },
          link: `/event/${event.shortId}`,
        });
        await sendPushToUser(inv.user, {
          title: `📅 Nouvelle date — ${event.title}`,
          body: `${dateLabel} — confirme ta présence`,
          url: `/event/${event.shortId}`,
          tag: `event-date-changed-${event.shortId}`,
          type: "events",
        });
      }
    } else {
      // ── Modification ordinaire (titre, lieu, description…) ────────────────
      for (const inv of invitations) {
        await notify(req.app, {
          userId: inv.user,
          type: "event_updated",
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
          type: "events",
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
    // Modération : exclure les messages des utilisateurs que j'ai bloqués
    let excluded = [];
    if (req.payload?._id) {
      const User = require("../../models/user.model");
      const me = await User.findById(req.payload._id).select("blockedUsers");
      excluded = me?.blockedUsers || [];
    }
    const messages = await EventMessage.find({
      event: req.event._id,
      ...(excluded.length ? { sender: { $nin: excluded } } : {}),
    })
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

      const {
        rsvp,
        dateVote,
        locationVote,
        giftProposed,
        giftVote,
        chatMessage,
        poolContribution,
      } = req.body;
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
        chatMessage:
          chatMessage !== undefined
            ? chatMessage
            : (current.chatMessage ?? true),
        poolContribution:
          poolContribution !== undefined
            ? poolContribution
            : (current.poolContribution ?? true),
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
