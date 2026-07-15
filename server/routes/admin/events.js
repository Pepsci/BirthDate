// routes/admin/events.js
// Supervision des événements (liste, détail, suppression avec cascade)

const express = require("express");
const router = express.Router();

const Event = require("../../models/event.model");
const EventInvitation = require("../../models/eventInvitation.model");
const EventGiftProposal = require("../../models/eventGiftProposal.model");
const EventMessage = require("../../models/eventMessage.model");
const GiftPoolContribution = require("../../models/giftPoolContribution.model");

/*
 * GET /api/admin/events?search=&status=&page=&limit=
 */
router.get("/", async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 25);
    const { search, status } = req.query;

    const query = {};
    if (status) query.status = status;
    if (search) {
      const rx = new RegExp(String(search).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      query.$or = [{ title: rx }, { shortId: rx }];
    }

    const [events, total] = await Promise.all([
      Event.find(query)
        .select("shortId title type status organizer fixedDate selectedDate dateMode giftPool createdAt")
        .populate("organizer", "name surname email")
        .sort({ _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Event.countDocuments(query),
    ]);

    // Nombre d'invités par event
    const eventIds = events.map((e) => e._id);
    const inviteCounts = await EventInvitation.aggregate([
      { $match: { event: { $in: eventIds } } },
      { $group: { _id: "$event", count: { $sum: 1 } } },
    ]);
    const countsByEvent = {};
    inviteCounts.forEach((c) => (countsByEvent[String(c._id)] = c.count));

    res.json({
      events: events.map((e) => ({
        ...e.toObject({ virtuals: false }),
        invitationsCount: countsByEvent[String(e._id)] || 0,
      })),
      total,
      page,
      pages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("❌ Admin events list error:", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

/*
 * DELETE /api/admin/events/:id — suppression + cascade (même logique que la
 * suppression organisateur dans routes/events/core.js).
 * Bloquée si des contributions encaissées non remboursées existent.
 */
router.delete("/:id", async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ message: "Événement introuvable" });

    const paidContributions = await GiftPoolContribution.countDocuments({
      event: event._id,
      status: "succeeded",
    });
    if (paidContributions > 0) {
      return res.status(400).json({
        message: `Cet événement a ${paidContributions} contribution(s) encaissée(s). Remboursez-les avant de supprimer l'événement.`,
      });
    }

    await EventInvitation.deleteMany({ event: event._id });
    await EventGiftProposal.deleteMany({ event: event._id });
    await EventMessage.deleteMany({ event: event._id });
    await GiftPoolContribution.deleteMany({ event: event._id });
    await Event.deleteOne({ _id: event._id });

    console.log(`🗑️ Admin delete event ${event.shortId} par admin ${req.payload._id}`);
    res.json({ message: "Événement supprimé" });
  } catch (error) {
    console.error("❌ Admin event delete error:", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

module.exports = router;
