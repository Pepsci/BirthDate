const express = require("express");
const router = express.Router();
const EventGiftProposal = require("../../models/eventGiftProposal.model");
const User = require("../../models/user.model");
const { checkGuestOrAuth } = require("../../middleware/checkGuestOrAuth");
const { notifyOrganizer } = require("./notifyOrganizer");

/*
 * POST /api/events/:shortId/gifts -> proposer un cadeau
 */
router.post("/:shortId/gifts", checkGuestOrAuth, async (req, res) => {
  try {
    const { name, url, price } = req.body;
    const event = req.event;

    // Vérifier la limite par user
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

    // Ne notifier que si ce n'est pas l'organisateur lui-même
    const isOrganizer =
      event.organizer.toString() === req.payload?._id?.toString();
    if (!isOrganizer) {
      const proposerName =
        req.guestName ||
        (await User.findById(req.payload?._id))?.name ||
        "Un invité";
      await notifyOrganizer(req.app, {
        event,
        type: "event_gift_proposed",
        data: {
          eventTitle: event.title,
          eventShortId: event.shortId,
          proposerName,
          giftName: name,
        },
        link: `/event/${event.shortId}`,
        pushPayload: {
          title: `🎁 Nouveau cadeau — ${event.title}`,
          body: `${proposerName} propose : ${name}`,
          url: `/event/${event.shortId}`,
          tag: `event-gift-proposed-${event.shortId}`,
          type: "default",
        },
      });
    }

    res.status(201).json(newProposal);
  } catch (error) {
    console.error("❌ Error creating gift proposal:", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

/*
 * GET /api/events/:shortId/gifts -> lister les propositions
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
 * POST /api/events/:shortId/gifts/:giftId/vote -> voter pour un cadeau
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
      let voted = false;

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
          voted = true;
        }
      } else if (guestToken) {
        const hasVoted = proposal.guestVotes.includes(guestToken);
        if (hasVoted) {
          proposal.guestVotes = proposal.guestVotes.filter(
            (t) => t !== guestToken,
          );
        } else {
          proposal.guestVotes.push(guestToken);
          voted = true;
        }
      }

      await proposal.save();

      // Ne notifier que si c'est un nouveau vote ET que ce n'est pas l'organisateur
      const isOrganizer = req.event.organizer.toString() === userId?.toString();
      if (voted && !isOrganizer) {
        const voterName =
          req.invitation?.guestName ||
          (await User.findById(userId))?.name ||
          "Un invité";
        await notifyOrganizer(req.app, {
          event: req.event,
          type: "event_gift_vote",
          data: {
            eventTitle: req.event.title,
            eventShortId: req.event.shortId,
            voterName,
            giftName: proposal.name,
          },
          link: `/event/${req.event.shortId}`,
          pushPayload: {
            title: `♥ Vote cadeau — ${req.event.title}`,
            body: `${voterName} vote pour : ${proposal.name}`,
            url: `/event/${req.event.shortId}`,
            tag: `event-gift-vote-${req.event.shortId}`,
            type: "default",
          },
        });
      }

      res.status(200).json(proposal);
    } catch (error) {
      console.error("❌ Error voting for gift:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  },
);

/*
 * PUT /api/events/:shortId/gifts/:giftId -> modifier une proposition
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

    if (!isOwner && req.userRole !== "organizer")
      return res.status(403).json({ message: "Non autorisé" });

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

/*
 * DELETE /api/events/:shortId/gifts/:giftId -> supprimer une proposition
 */
router.delete("/:shortId/gifts/:giftId", checkGuestOrAuth, async (req, res) => {
  try {
    const proposal = await EventGiftProposal.findById(req.params.giftId);
    if (!proposal)
      return res.status(404).json({ message: "Proposition introuvable" });

    const isOwner =
      (req.payload?._id &&
        proposal.proposedBy?.toString() === req.payload._id) ||
      (req.guestName && proposal.guestName === req.guestName);

    if (!isOwner && req.userRole !== "organizer")
      return res.status(403).json({ message: "Non autorisé" });

    await proposal.deleteOne();
    res.status(200).json({ message: "Proposition supprimée" });
  } catch (error) {
    console.error("❌ Error deleting gift proposal:", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

module.exports = router;
