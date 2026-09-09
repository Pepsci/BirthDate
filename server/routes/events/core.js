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
  sendEventCancelledEmail,
} = require("../../services/emailTemplates/eventEmails");
const User = require("../../models/user.model");
const { audit } = require("../../services/auditLog");

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

    // Après la réponse : le journal ne doit ni retarder ni faire échouer la
    // création, qui est déjà en base à ce stade.
    await audit(req, {
      action: "event_create",
      userId: req.payload._id,
      metadata: {
        eventShortId: newEvent.shortId,
        title: newEvent.title,
        type: newEvent.type,
        status: newEvent.status,
      },
    });
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
 * GET /api/events/mine/chats -> mes conversations d'événement
 *
 * Les discussions d'événement n'apparaissaient nulle part dans la liste des
 * conversations : on ne pouvait les retrouver qu'en rouvrant l'événement
 * lui-même. Un message y restait donc invisible tant qu'on n'allait pas le
 * chercher, alors que c'est exactement l'endroit où l'on va lire ses messages.
 *
 * Seuls les événements AYANT DÉJÀ des messages sont renvoyés : une liste de
 * conversations vides n'aide personne à trouver la sienne.
 *
 * ⚠️ Doit être déclarée AVANT `/:shortId` — sinon "mine" serait pris pour un
 * identifiant d'événement.
 */
router.get("/mine/chats", isAuthenticated, async (req, res) => {
  try {
    const userId = req.payload._id;
    const EventMessage = require("../../models/eventMessage.model");

    const [organized, invitations] = await Promise.all([
      Event.find({ organizer: userId, status: { $ne: "cancelled" } }).select(
        "shortId title forPerson type",
      ),
      EventInvitation.find({ user: userId }).populate({
        path: "event",
        match: { status: { $ne: "cancelled" } },
        select: "shortId title forPerson type organizer",
      }),
    ]);

    const byId = new Map();
    for (const e of organized) byId.set(e._id.toString(), e);
    for (const inv of invitations) {
      if (inv.event) byId.set(inv.event._id.toString(), inv.event);
    }
    const events = [...byId.values()];
    if (events.length === 0) return res.status(200).json([]);

    const rows = await Promise.all(
      events.map(async (ev) => {
        const last = await EventMessage.findOne({ event: ev._id })
          .sort({ createdAt: -1 })
          .populate("sender", "name surname");
        if (!last) return null;

        const unreadCount = await EventMessage.countDocuments({
          event: ev._id,
          sender: { $ne: userId },
          "readBy.user": { $ne: userId },
        });

        return {
          _id: ev._id,
          shortId: ev.shortId,
          title: ev.title,
          type: ev.type,
          unreadCount,
          lastMessage: {
            // Le contenu chiffré ne se déchiffre que sur l'appareil : on le
            // transmet tel quel, le client affichera « message chiffré ».
            content: last.content,
            isEncrypted: !!last.isEncrypted,
            sender: last.sender
              ? { _id: last.sender._id, name: last.sender.name }
              : null,
            createdAt: last.createdAt,
          },
          lastMessageAt: last.createdAt,
        };
      }),
    );

    const chats = rows
      .filter(Boolean)
      .sort(
        (a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt),
      );
    res.status(200).json(chats);
  } catch (error) {
    console.error("❌ Error fetching event chats:", error);
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
      .populate("forDate", "name date")
      // Le destinataire d'une proposition de transfert doit pouvoir l'afficher
      // avec un nom, pas un identifiant.
      .populate("pendingTransfer.toUser", "name surname avatar")
      .populate("pendingTransfer.requestedBy", "name surname");

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
      // Le motif d'annulation accompagne le statut. Sans lui, la page publique
      // afficherait « annulé — l'organisateur n'a pas indiqué de raison » alors
      // qu'il en a donné une : un message faux, pire que pas de message. Il est
      // du même ordre de confidentialité que le titre et la description, déjà
      // exposés ici.
      cancelledAt: event.cancelledAt,
      cancellationReason: event.cancellationReason,
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
    // Idem pour le lieu : trancher un vote de lieu est une nouvelle, pas une
    // « modification ordinaire ». Sans ce repère, ceux qui ont voté
    // recevaient « l'événement a été modifié » et devaient aller voir
    // eux-mêmes quelle option l'avait emporté.
    const locationBefore = event.selectedLocation?.name || null;

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
    const locationAfter = event.selectedLocation?.name || null;
    const locationSettled = !!locationAfter && locationAfter !== locationBefore;

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
      // Un lieu qui vient d'être retenu porte l'information la plus attendue
      // du moment : on le dit, plutôt que de laisser le message générique.
      const label = locationSettled
        ? `Le lieu est retenu : ${locationAfter}`
        : "L'événement a été modifié par l'organisateur";
      for (const inv of invitations) {
        await notify(req.app, {
          userId: inv.user,
          type: "event_updated",
          data: {
            eventTitle: event.title,
            eventShortId: event.shortId,
            message: label,
          },
          link: `/event/${event.shortId}`,
        });
        await sendPushToUser(inv.user, {
          title: locationSettled
            ? `📍 Lieu retenu — ${event.title}`
            : `✏️ Événement modifié — ${event.title}`,
          body: locationSettled
            ? locationAfter
            : "L'organisateur a mis à jour les informations",
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

    // ⚠️ La suppression définitive est désormais réservée aux brouillons et aux
    // événements déjà annulés. Supprimer directement un événement publié le
    // faisait disparaître de la liste de chaque invité sans un mot, en
    // emportant le chat et l'historique : c'est précisément ce que l'annulation
    // évite. On demande donc d'annuler d'abord — les invités sont prévenus et
    // comprennent — puis de supprimer si on veut vraiment effacer.
    if (event.status !== "draft" && event.status !== "cancelled") {
      return res.status(409).json({
        code: "CANCEL_BEFORE_DELETE",
        message:
          "Annule d'abord cet événement : tes invités seront prévenus. Tu pourras le supprimer ensuite.",
      });
    }

    // Trace écrite AVANT la suppression : après, il ne resterait plus rien à
    // décrire — ni le titre, ni la date, ni le nombre d'invités prévenus.
    const invitationCount = await EventInvitation.countDocuments({
      event: event._id,
    });
    await audit(req, {
      action: "event_delete",
      userId: req.payload._id,
      metadata: {
        eventShortId: event.shortId,
        title: event.title,
        status: event.status,
        date: event.selectedDate || event.fixedDate || null,
        invitationCount,
        poolWasActive: !!event.giftPool?.active,
      },
    });

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
 * POST /api/events/:shortId/cancel — annuler un événement (organizer only)
 * Body: { reason?: string }
 *
 * ⚠️ Annuler n'est PAS supprimer, et c'est délibéré. Une suppression fait
 * disparaître l'événement de la liste de chaque invité sans un mot : ils
 * gardent une date en tête, un cadeau acheté, parfois une contribution versée,
 * et plus rien à consulter. L'annulation conserve la page, le chat et
 * l'historique, en les surmontant d'un motif. La suppression définitive reste
 * possible, mais après.
 */
router.post("/:shortId/cancel", isAuthenticated, async (req, res) => {
  try {
    const event = await Event.findOne({ shortId: req.params.shortId });
    if (!event)
      return res.status(404).json({ message: "Événement introuvable" });
    if (event.organizer.toString() !== req.payload._id)
      return res.status(403).json({ message: "Non autorisé" });
    if (event.status === "cancelled")
      return res.status(400).json({ message: "Événement déjà annulé" });
    if (event.status === "draft")
      return res.status(400).json({
        code: "DRAFT_NOT_CANCELLABLE",
        message:
          "Un brouillon n'a jamais été annoncé : il se supprime, il ne s'annule pas.",
      });

    const reason = (req.body?.reason || "").trim().slice(0, 500) || null;

    event.status = "cancelled";
    event.cancelledAt = new Date();
    event.cancelledBy = req.payload._id;
    event.cancellationReason = reason;

    // ── Cagnotte ──────────────────────────────────────────────────────────
    // On coupe la collecte : accepter de nouvelles contributions sur un
    // événement annulé serait indéfendable. On ne rembourse rien ici — c'est
    // une décision qui appartient à l'organisateur, et une opération Stripe
    // qui a son propre écran (voir la gestion des remboursements).
    const poolWasActive = !!event.giftPool?.active;
    if (poolWasActive) {
      event.giftPool.active = false;
      event.giftPoolEnabled = false;
    }

    await event.save();

    const organizer = await User.findById(event.organizer).select("name");
    const organizerName = organizer?.name || null;

    res.status(200).json({
      status: event.status,
      cancelledAt: event.cancelledAt,
      cancellationReason: event.cancellationReason,
      poolFrozen: poolWasActive,
    });

    // ── Après la réponse : personne à prévenir ne doit retarder l'annulation,
    //    déjà enregistrée en base à ce stade. ───────────────────────────────
    await audit(req, {
      action: "event_cancel",
      userId: req.payload._id,
      metadata: {
        eventShortId: event.shortId,
        title: event.title,
        reason,
        date: event.selectedDate || event.fixedDate || null,
        poolFrozen: poolWasActive,
      },
    });
    if (poolWasActive) {
      await audit(req, {
        action: "pool_freeze",
        userId: req.payload._id,
        metadata: { eventShortId: event.shortId, cause: "event_cancelled" },
      });
    }

    const invitations = await EventInvitation.find({ event: event._id });
    const body = reason
      ? reason.slice(0, 120)
      : "L'organisateur n'a pas indiqué de raison.";

    for (const inv of invitations) {
      // L'organisateur sait déjà qu'il vient d'annuler.
      if (inv.user && inv.user.toString() === req.payload._id) continue;

      if (inv.user) {
        await notify(req.app, {
          userId: inv.user,
          type: "event_cancelled",
          data: {
            eventTitle: event.title,
            eventShortId: event.shortId,
            reason,
            message: `« ${event.title} » a été annulé.`,
          },
          link: `/event/${event.shortId}`,
        });
        await sendPushToUser(inv.user, {
          title: `❌ Annulé — ${event.title}`,
          body,
          url: `/event/${event.shortId}`,
          tag: `event-cancelled-${event.shortId}`,
          type: "events",
        });
      }
    }

    // ── Invités externes : l'email est leur seul canal ────────────────────
    // Sans compte, ni notification in-app ni push ne les atteint. Un même
    // email peut porter plusieurs invitations (invité nommément puis arrivé
    // par le code) : on n'envoie qu'une fois.
    const seenEmails = new Set();
    for (const inv of invitations) {
      const to = (inv.externalEmail || "").trim().toLowerCase();
      if (!to || seenEmails.has(to)) continue;
      seenEmails.add(to);
      try {
        await sendEventCancelledEmail(inv.externalEmail, {
          event,
          reason,
          organizerName,
        });
      } catch (mailErr) {
        console.error(
          `❌ Email d'annulation non envoyé à ${inv.externalEmail}:`,
          mailErr.message,
        );
      }
    }

    // Les comptes reçoivent aussi l'email : une notification push se rate, et
    // une annulation est exactement le message qu'on ne veut pas rater.
    const memberIds = invitations
      .filter((i) => i.user && i.user.toString() !== req.payload._id)
      .map((i) => i.user);
    if (memberIds.length) {
      const members = await User.find({
        _id: { $in: memberIds },
        deletedAt: { $exists: false },
      }).select("email");
      for (const m of members) {
        const to = (m.email || "").trim().toLowerCase();
        if (!to || seenEmails.has(to)) continue;
        seenEmails.add(to);
        try {
          await sendEventCancelledEmail(m.email, {
            event,
            reason,
            organizerName,
          });
        } catch (mailErr) {
          console.error(
            `❌ Email d'annulation non envoyé à ${m.email}:`,
            mailErr.message,
          );
        }
      }
    }

    // Temps réel : une page ouverte doit afficher le bandeau sans refresh.
    req.app.get("io")?.to(`event:${event.shortId}`).emit("event:cancelled", {
      shortId: event.shortId,
      reason,
      cancelledAt: event.cancelledAt,
    });
  } catch (error) {
    console.error("❌ Error cancelling event:", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

/*
 * POST /api/events/:shortId/uncancel — rétablir un événement annulé
 *
 * Une annulation part d'un geste unique et irrattrapable autrement : erreur de
 * manipulation, ou décision revue dans la foulée. Rétablir remet l'événement
 * en "published" et prévient tout le monde — mais ne réactive PAS la cagnotte :
 * relancer une collecte d'argent est une décision distincte, que l'organisateur
 * doit reprendre explicitement depuis son écran.
 */
router.post("/:shortId/uncancel", isAuthenticated, async (req, res) => {
  try {
    const event = await Event.findOne({ shortId: req.params.shortId });
    if (!event)
      return res.status(404).json({ message: "Événement introuvable" });
    if (event.organizer.toString() !== req.payload._id)
      return res.status(403).json({ message: "Non autorisé" });
    if (event.status !== "cancelled")
      return res.status(400).json({ message: "Cet événement n'est pas annulé" });

    const previousReason = event.cancellationReason;
    event.status = "published";
    event.cancelledAt = null;
    event.cancelledBy = null;
    event.cancellationReason = null;
    await event.save();

    res.status(200).json({ status: event.status });

    await audit(req, {
      action: "event_uncancel",
      userId: req.payload._id,
      metadata: {
        eventShortId: event.shortId,
        title: event.title,
        previousReason,
      },
    });

    const invitations = await EventInvitation.find({ event: event._id });
    for (const inv of invitations) {
      if (!inv.user || inv.user.toString() === req.payload._id) continue;
      await notify(req.app, {
        userId: inv.user,
        type: "event_uncancelled",
        data: {
          eventTitle: event.title,
          eventShortId: event.shortId,
          message: `« ${event.title} » est rétabli : il aura bien lieu.`,
        },
        link: `/event/${event.shortId}`,
      });
      await sendPushToUser(inv.user, {
        title: `✅ Rétabli — ${event.title}`,
        body: "L'événement aura finalement bien lieu.",
        url: `/event/${event.shortId}`,
        tag: `event-uncancelled-${event.shortId}`,
        type: "events",
      });
    }

    req.app.get("io")?.to(`event:${event.shortId}`).emit("event:uncancelled", {
      shortId: event.shortId,
    });
  } catch (error) {
    console.error("❌ Error uncancelling event:", error);
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
