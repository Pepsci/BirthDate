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

/*
 * POST /api/events/:shortId/invite -> inviter des utilisateurs inscrits
 */
router.post("/:shortId/invite", isAuthenticated, async (req, res) => {
  try {
    const event = await Event.findOne({ shortId: req.params.shortId }).populate("organizer", "name surname");
    if (!event) return res.status(404).json({ message: "Événement introuvable" });
    if (event.organizer._id.toString() !== req.payload._id) return res.status(403).json({ message: "Non autorisé" });

    const { userIds, externalEmails } = req.body;
    const baseUrl = process.env.FRONTEND_URL || "https://birthreminder.com";
    const eventUrl = `${baseUrl}/event/${event.shortId}`;
    const organizerName = `${event.organizer.name} ${event.organizer.surname || ""}`.trim();

    if (userIds?.length > 0) {
      for (const uid of userIds) {
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
    if (event.accessCode !== code) return res.status(403).json({ message: "Code d'accès invalide" });

    let tokenPayload = null;
    const cookieToken = req.cookies?.authToken;
    if (cookieToken) {
      try { tokenPayload = require("jsonwebtoken").verify(cookieToken, process.env.TOKEN_SECRET); } catch (_) {}
    }

    if (event.maxGuests !== null) {
      const count = await EventInvitation.countDocuments({ event: event._id, status: { $in: ["accepted", "maybe"] } });
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
