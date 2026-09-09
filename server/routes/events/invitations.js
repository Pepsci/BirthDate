const express = require("express");
const router = express.Router();
const Event = require("../../models/event.model");
const EventInvitation = require("../../models/eventInvitation.model");
const User = require("../../models/user.model");
const { nanoid } = require("nanoid");
const { isAuthenticated } = require("../../middleware/jwt.middleware");
const { checkGuestOrAuth } = require("../../middleware/checkGuestOrAuth");
const { notify } = require("../../utils/notify");
const { sendPushToUser } = require("../../services/pushService");
const { sendEventInvitationEmail } = require("../../services/emailTemplates/eventEmails");
const { filterBlockedIds } = require("../../utils/blocking");

/*
 * POST /api/events/:shortId/invite -> inviter des utilisateurs inscrits
 */
router.post("/:shortId/invite", isAuthenticated, async (req, res) => {
  try {
    const event = await Event.findOne({ shortId: req.params.shortId }).populate("organizer", "name surname");
    if (!event) return res.status(404).json({ message: "Événement introuvable" });

    // Inviter quelqu'un à un événement annulé n'a aucun sens : il recevrait une
    // invitation pour quelque chose qui n'aura pas lieu.
    if (event.status === "cancelled")
      return res.status(409).json({
        code: "EVENT_CANCELLED",
        message: "Cet événement est annulé : il n'accepte plus d'invitations.",
      });

    const isOrganizer = event.organizer._id.toString() === req.payload._id;
    if (!isOrganizer) {
      // Un invité peut inviter ses amis uniquement si l'organisateur l'a autorisé
      if (!event.allowGuestInvites)
        return res.status(403).json({ message: "Non autorisé" });
      const isParticipant = await EventInvitation.findOne({
        event: event._id,
        user: req.payload._id,
      });
      if (!isParticipant)
        return res.status(403).json({ message: "Non autorisé" });
    }

    const { userIds, externalEmails } = req.body;
    const baseUrl = process.env.FRONTEND_URL || "https://birthreminder.com";
    const eventUrl = `${baseUrl}/event/${event.shortId}`;
    const organizerName = `${event.organizer.name} ${event.organizer.surname || ""}`.trim();

    if (userIds?.length > 0) {
      // Modération : on écarte silencieusement les personnes en situation de
      // blocage avec l'invitant (dans un sens ou dans l'autre). Un envoi
      // groupé ne doit pas devenir un moyen de contourner un blocage.
      // Silencieusement : la réponse ne dit pas qui a été écarté.
      const blocked = await filterBlockedIds(req.payload._id, userIds);

      for (const uid of userIds) {
        if (blocked.has(String(uid))) continue;
        const existing = await EventInvitation.findOne({ event: event._id, user: uid });
        if (!existing) {
          await EventInvitation.create({ event: event._id, user: uid });
          await notify(req.app, {
            userId: uid,
            type: "event_reminder",
            data: { eventTitle: event.title, eventShortId: event.shortId, organizerName },
            link: `/event/${event.shortId}`,
          });
          await sendPushToUser(uid, {
            title: `🎉 Invitation — ${event.title}`,
            body: `${organizerName} vous invite à un événement`,
            url: `/event/${event.shortId}`,
            tag: `event-invite-${event.shortId}-${uid}`,
            type: "default",
          });
          const targetedUser = await User.findById(uid);
          if (targetedUser) await sendEventInvitationEmail(targetedUser.email, event, event.organizer.name, eventUrl);
        }
      }
    }

    if (externalEmails?.length > 0) {
      for (const email of externalEmails) {
        const existing = await EventInvitation.findOne({ event: event._id, externalEmail: email });
        if (!existing) {
          await EventInvitation.create({ event: event._id, externalEmail: email });
          await sendEventInvitationEmail(email, event, event.organizer.name, eventUrl);
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
 * POST /api/events/:shortId/join -> rejoindre via code
 */
router.post("/:shortId/join", async (req, res) => {
  try {
    const { code, guestName, externalEmail } = req.body;
    const event = await Event.findOne({ shortId: req.params.shortId });

    if (!event) return res.status(404).json({ message: "Événement introuvable" });
    if (event.status === "cancelled")
      return res.status(409).json({
        code: "EVENT_CANCELLED",
        message: "Cet événement est annulé.",
      });
    if (event.accessCode !== code) return res.status(403).json({ message: "Code d'accès invalide" });

    let tokenPayload = null;
    const cookieToken = req.cookies?.authToken;
    if (cookieToken) {
      try { tokenPayload = require("jsonwebtoken").verify(cookieToken, process.env.TOKEN_SECRET); } catch (_) {}
    }

    if (event.maxGuests !== null) {
      // `$nin: [event.organizer]` : l'organisateur compte désormais parmi les
      // participants, mais `maxGuests` désigne un nombre d'INVITÉS. Sans cette
      // exclusion, chaque événement existant perdrait une place d'un coup.
      const count = await EventInvitation.countDocuments({ event: event._id, status: { $in: ["accepted", "maybe"] }, user: { $nin: [event.organizer] } });
      if (count >= event.maxGuests) return res.status(400).json({ message: "L'événement est complet" });
    }

    let invitation;

    if (tokenPayload) {
      invitation = await EventInvitation.findOne({ event: event._id, user: tokenPayload._id });
      if (!invitation) {
        invitation = await EventInvitation.create({ event: event._id, user: tokenPayload._id, joinedViaCode: true, status: "accepted" });
      }
      return res.status(200).json({ message: "Rejoint avec succès", invitation });
    }

    if (!event.allowExternalGuests) return res.status(403).json({ message: "Les invités externes ne sont pas autorisés." });
    if (!guestName) return res.status(200).json({ message: "Code valide, accès accordé", unlockSession: true });

    invitation = await EventInvitation.findOne({ event: event._id, guestName, externalEmail: externalEmail || null, user: null });
    if (!invitation) {
      invitation = await EventInvitation.create({
        event: event._id, externalEmail: externalEmail || null, guestName,
        joinedViaCode: true, status: "accepted", guestToken: nanoid(32),
      });
    }

    return res.status(200).json({ message: "Rejoint avec succès", invitation, guestToken: invitation.guestToken });
  } catch (error) {
    console.error("❌ Error joining event:", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

/*
 * POST /api/events/:shortId/claim -> rattacher une participation invité au compte
 *
 * Appelé juste après une connexion ou une inscription, quand la personne était
 * jusque-là un invité sans compte (`guestToken` en local).
 *
 * ⚠️ On CONVERTIT l'invitation existante, on n'en crée pas une seconde. Tout ce
 * que la personne a déjà fait vit sur cette invitation — sa réponse à
 * l'invitation, ses votes de date, son vote de lieu. En créant une nouvelle
 * ligne, elle repartirait de zéro et l'organisateur verrait deux participants
 * là où il n'y a qu'une personne.
 *
 * Les idées cadeaux, elles, sont ailleurs et portent un `guestName` en clair :
 * on les réattribue au compte, sinon leur auteur perdrait le droit de les
 * modifier ou de les retirer le jour où il se crée un compte.
 */
router.post("/:shortId/claim", isAuthenticated, async (req, res) => {
  try {
    const { guestToken, code } = req.body || {};
    const userId = req.payload._id;

    const event = await Event.findOne({ shortId: req.params.shortId });
    if (!event)
      return res.status(404).json({ message: "Événement introuvable" });

    // L'organisateur n'a rien à rattacher : il participe par définition.
    if (event.organizer.toString() === userId)
      return res.status(200).json({ claimed: false, alreadyIn: true });

    const EventGiftProposal = require("../../models/eventGiftProposal.model");

    // L'invitation invité visée, s'il y en a une.
    const guestInv = guestToken
      ? await EventInvitation.findOne({
          event: event._id,
          guestToken,
          user: null,
        })
      : null;

    const mine = await EventInvitation.findOne({
      event: event._id,
      user: userId,
    });

    // Déjà participant avec ce compte, ET une participation invité en plus.
    // Les deux lignes décrivent une seule personne : il faut n'en garder
    // qu'une, sinon elle figure deux fois dans la liste et compte double dans
    // les places disponibles.
    //
    // ⚠️ Supprimer purement et simplement la ligne invité effacerait ce que la
    // personne a fait AVANT de se connaître un compte : sa réponse à
    // l'invitation et ses votes vivent sur cette ligne-là. On reporte donc ce
    // que le compte n'a pas déjà, puis seulement on supprime.
    //
    // Règle de report, volontairement bête et prévisible : le compte l'emporte
    // dès qu'il s'est prononcé, l'invité comble les blancs. Arbitrer par
    // ancienneté serait plus malin et beaucoup moins compréhensible — la
    // personne verrait sa réponse changer sans savoir pourquoi.
    if (mine) {
      if (guestInv) {
        if (guestInv.guestName) {
          await EventGiftProposal.updateMany(
            { event: event._id, guestName: guestInv.guestName },
            { proposedBy: userId, guestName: null },
          );
        }

        let changed = false;
        if (
          (!mine.status || mine.status === "pending") &&
          guestInv.status &&
          guestInv.status !== "pending"
        ) {
          mine.status = guestInv.status;
          changed = true;
        }
        if (
          (!mine.dateVote || mine.dateVote.length === 0) &&
          guestInv.dateVote?.length
        ) {
          mine.dateVote = guestInv.dateVote;
          changed = true;
        }
        if (!mine.locationVote && guestInv.locationVote) {
          mine.locationVote = guestInv.locationVote;
          changed = true;
        }
        if (changed) await mine.save();

        await guestInv.deleteOne();
      }
      return res
        .status(200)
        .json({ claimed: !!guestInv, alreadyIn: true, invitation: mine });
    }

    if (guestInv) {
      if (guestInv.guestName) {
        await EventGiftProposal.updateMany(
          { event: event._id, guestName: guestInv.guestName },
          { proposedBy: userId, guestName: null },
        );
      }
      guestInv.user = userId;
      // Le nom saisi à la volée s'efface au profit du nom du compte : c'est
      // désormais une personne identifiée, et les notifications comme la liste
      // des participants doivent l'appeler par son vrai nom.
      guestInv.guestName = null;
      // Le jeton invité ne doit plus ouvrir cette participation : elle
      // appartient à un compte, et une seule identité doit y donner accès.
      guestInv.guestToken = null;
      await guestInv.save();
      return res.status(200).json({ claimed: true, invitation: guestInv });
    }

    // Aucune trace d'invité : la personne arrive par le lien et vient de créer
    // son compte. Le code d'accès reste exigé, exactement comme pour rejoindre.
    if (!code || code !== event.accessCode)
      return res
        .status(403)
        .json({ code: "NO_GUEST_SESSION", message: "Code d'accès requis." });

    if (event.status === "cancelled")
      return res
        .status(409)
        .json({ code: "EVENT_CANCELLED", message: "Cet événement est annulé." });

    if (event.maxGuests !== null) {
      const count = await EventInvitation.countDocuments({
        event: event._id,
        status: { $in: ["accepted", "maybe"] },
        user: { $nin: [event.organizer] },
      });
      if (count >= event.maxGuests)
        return res.status(400).json({ message: "L'événement est complet" });
    }

    const created = await EventInvitation.create({
      event: event._id,
      user: userId,
      joinedViaCode: true,
      status: "accepted",
    });
    return res.status(200).json({ claimed: true, invitation: created });
  } catch (error) {
    console.error("❌ Error claiming event participation:", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

/*
 * GET/PUT /api/events/:shortId/my-notifications
 * Réglages de notifications de CET événement, pour CELUI QUI DEMANDE.
 *
 * ⚠️ À ne pas confondre avec PUT /invitations/:id/notifications, réservée à
 * l'organisateur : elle sert à régler les notifications de QUELQU'UN D'AUTRE,
 * et personne ne pouvait donc régler les siennes.
 *
 * Les catégories dépendent du rôle, parce que les notifications ne partent
 * pas aux mêmes personnes : les réponses, les votes, les cadeaux proposés et
 * les contributions ne concernent que l'organisateur. Proposer ces
 * interrupteurs à un invité afficherait des réglages sans effet.
 */
function myNotificationPayload(event, invitation, isOrganizer) {
  if (isOrganizer) {
    const p = event.organizerNotificationPrefs || {};
    return {
      role: "organizer",
      prefs: {
        chatMessage: p.chatMessage !== false,
        rsvp: p.rsvp !== false,
        dateVote: p.dateVote !== false,
        locationVote: p.locationVote !== false,
        giftProposed: p.giftProposed !== false,
        giftVote: p.giftVote !== false,
        poolContribution: p.poolContribution !== false,
      },
    };
  }
  const p = invitation?.notificationPreferences || {};
  return {
    role: "participant",
    prefs: {
      chatMessage: p.chatMessage !== false,
      eventUpdates: p.eventUpdates !== false,
    },
  };
}

router.get("/:shortId/my-notifications", isAuthenticated, async (req, res) => {
  try {
    const event = await Event.findOne({ shortId: req.params.shortId });
    if (!event)
      return res.status(404).json({ message: "Événement introuvable" });

    const isOrganizer = event.organizer.toString() === req.payload._id;
    const invitation = isOrganizer
      ? null
      : await EventInvitation.findOne({
          event: event._id,
          user: req.payload._id,
        });
    if (!isOrganizer && !invitation)
      return res.status(403).json({ message: "Non autorisé" });

    res
      .status(200)
      .json(myNotificationPayload(event, invitation, isOrganizer));
  } catch (error) {
    console.error("❌ Error reading my notification prefs:", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

router.put("/:shortId/my-notifications", isAuthenticated, async (req, res) => {
  try {
    const event = await Event.findOne({ shortId: req.params.shortId });
    if (!event)
      return res.status(404).json({ message: "Événement introuvable" });

    const isOrganizer = event.organizer.toString() === req.payload._id;
    const body = req.body || {};
    // Seules les clés reconnues sont écrites, et seulement celles du rôle :
    // un participant ne doit pas pouvoir poser des réglages d'organisateur.
    const allowed = isOrganizer
      ? [
          "chatMessage",
          "rsvp",
          "dateVote",
          "locationVote",
          "giftProposed",
          "giftVote",
          "poolContribution",
        ]
      : ["chatMessage", "eventUpdates"];

    if (isOrganizer) {
      const current = event.organizerNotificationPrefs || {};
      const next = { ...current.toObject?.() ?? current };
      for (const key of allowed) {
        if (body[key] !== undefined) next[key] = !!body[key];
      }
      event.organizerNotificationPrefs = next;
      await event.save();
      return res
        .status(200)
        .json(myNotificationPayload(event, null, true));
    }

    const invitation = await EventInvitation.findOne({
      event: event._id,
      user: req.payload._id,
    });
    if (!invitation)
      return res.status(403).json({ message: "Non autorisé" });

    const current = invitation.notificationPreferences || {};
    const next = { ...(current.toObject?.() ?? current) };
    for (const key of allowed) {
      if (body[key] !== undefined) next[key] = !!body[key];
    }
    invitation.notificationPreferences = next;
    await invitation.save();
    res.status(200).json(myNotificationPayload(event, invitation, false));
  } catch (error) {
    console.error("❌ Error updating my notification prefs:", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

/*
 * DELETE /api/events/:shortId/leave -> quitter (invité only)
 */
router.delete("/:shortId/leave", isAuthenticated, async (req, res) => {
  try {
    const event = await Event.findOne({ shortId: req.params.shortId });
    if (!event) return res.status(404).json({ message: "Événement introuvable" });
    if (event.organizer.toString() === req.payload._id) return res.status(403).json({ message: "L'organisateur ne peut pas quitter son propre événement" });

    const deleted = await EventInvitation.findOneAndDelete({ event: event._id, user: req.payload._id });
    if (!deleted) return res.status(404).json({ message: "Invitation introuvable" });

    res.status(200).json({ message: "Vous avez quitté l'événement" });
  } catch (error) {
    console.error("❌ Error leaving event:", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

/*
 * GET /api/events/:shortId/invitations
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
 * DELETE /api/events/:shortId/invitations/:invitationId -> retirer un invité (organizer only)
 */
router.delete("/:shortId/invitations/:invitationId", isAuthenticated, async (req, res) => {
  try {
    const event = await Event.findOne({ shortId: req.params.shortId });
    if (!event) return res.status(404).json({ message: "Événement introuvable" });
    if (event.organizer.toString() !== req.payload._id) return res.status(403).json({ message: "Non autorisé" });

    const invitation = await EventInvitation.findById(req.params.invitationId);
    if (!invitation) return res.status(404).json({ message: "Invitation introuvable" });
    if (invitation.event.toString() !== event._id.toString()) return res.status(403).json({ message: "Cette invitation n'appartient pas à cet événement" });
    // Pendant de `DELETE /:shortId/leave` : l'organisateur ne peut pas quitter
    // son événement, il ne peut donc pas non plus se retirer des participants.
    if (invitation.user && invitation.user.toString() === event.organizer.toString())
      return res.status(403).json({ message: "L'organisateur ne peut pas être retiré de son propre événement" });

    await invitation.deleteOne();
    res.status(200).json({ message: "Invité retiré" });
  } catch (error) {
    console.error("❌ Error removing invitation:", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

/*
 * PUT /api/events/:shortId/invitations/:invitationId/notifications -> préférences notifs organisateur
 */
router.put("/:shortId/invitations/:invitationId/notifications", isAuthenticated, async (req, res) => {
  try {
    const event = await Event.findOne({ shortId: req.params.shortId });
    if (!event) return res.status(404).json({ message: "Événement introuvable" });
    if (event.organizer.toString() !== req.payload._id) return res.status(403).json({ message: "Non autorisé" });

    const invitation = await EventInvitation.findById(req.params.invitationId);
    if (!invitation) return res.status(404).json({ message: "Invitation introuvable" });

    const { rsvp, dateVote, locationVote, giftProposed, giftVote } = req.body;
    const current = invitation.notificationPreferences || {};

    invitation.notificationPreferences = {
      rsvp: rsvp !== undefined ? rsvp : (current.rsvp ?? true),
      dateVote: dateVote !== undefined ? dateVote : (current.dateVote ?? true),
      locationVote: locationVote !== undefined ? locationVote : (current.locationVote ?? true),
      giftProposed: giftProposed !== undefined ? giftProposed : (current.giftProposed ?? true),
      giftVote: giftVote !== undefined ? giftVote : (current.giftVote ?? true),
    };

    await invitation.save();
    res.status(200).json(invitation);
  } catch (error) {
    console.error("❌ Error updating notification preferences:", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

/*
 * GET /api/events/:shortId/invitations/:invitationId/notifications -> lire les préférences
 */
router.get("/:shortId/invitations/:invitationId/notifications", isAuthenticated, async (req, res) => {
  try {
    const event = await Event.findOne({ shortId: req.params.shortId });
    if (!event) return res.status(404).json({ message: "Événement introuvable" });
    if (event.organizer.toString() !== req.payload._id) return res.status(403).json({ message: "Non autorisé" });

    const invitation = await EventInvitation.findById(req.params.invitationId);
    if (!invitation) return res.status(404).json({ message: "Invitation introuvable" });

    res.status(200).json(invitation.notificationPreferences || {
      rsvp: true, dateVote: true, locationVote: true, giftProposed: true, giftVote: true,
    });
  } catch (error) {
    console.error("❌ Error fetching notification preferences:", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

module.exports = router;
