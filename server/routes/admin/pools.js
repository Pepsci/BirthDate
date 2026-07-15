// routes/admin/pools.js
// Supervision des cagnottes + remboursement via Stripe.
// ⚠️ Les fonds ne transitent JAMAIS hors Stripe : le remboursement passe par
// l'API Stripe sur le compte Connect de l'organisateur (charge directe).

const express = require("express");
const router = express.Router();

const stripe = require("../../config/stripe.config");
const Event = require("../../models/event.model");
const StripeAccount = require("../../models/stripeAccount.model");
const GiftPoolContribution = require("../../models/giftPoolContribution.model");

/*
 * GET /api/admin/pools?page=&limit=&active=true
 * Liste des cagnottes (events avec giftPool) + totaux par event.
 */
router.get("/", async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 25);

    const query = { "giftPool.active": true };
    if (req.query.active === "false") query["giftPool.active"] = false;
    if (req.query.active === "all") delete query["giftPool.active"];

    const [events, total] = await Promise.all([
      Event.find(query)
        .select("shortId title type organizer giftPool status fixedDate selectedDate")
        .populate("organizer", "name surname email")
        .sort({ _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Event.countDocuments(query),
    ]);

    // Totaux par event en une seule agrégation
    const eventIds = events.map((e) => e._id);
    const totals = await GiftPoolContribution.aggregate([
      { $match: { event: { $in: eventIds } } },
      {
        $group: {
          _id: { event: "$event", status: "$status" },
          count: { $sum: 1 },
          total: { $sum: "$amount" },
        },
      },
    ]);

    const totalsByEvent = {};
    totals.forEach((t) => {
      const id = String(t._id.event);
      if (!totalsByEvent[id]) totalsByEvent[id] = {};
      totalsByEvent[id][t._id.status] = { count: t.count, total: t.total };
    });

    res.json({
      pools: events.map((e) => ({
        eventId: e._id,
        shortId: e.shortId,
        title: e.title,
        type: e.type,
        status: e.status,
        organizer: e.organizer,
        giftPool: e.giftPool,
        date: e.selectedDate || e.fixedDate || null,
        totals: totalsByEvent[String(e._id)] || {},
      })),
      total,
      page,
      pages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("❌ Admin pools list error:", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

/*
 * GET /api/admin/pools/alerts
 * Alertes anti-fraude calculées à la volée (règles dans poolFraudService).
 */
router.get("/alerts", async (req, res) => {
  try {
    const { computePoolAlerts, THRESHOLDS } = require("../../services/poolFraudService");
    const alerts = await computePoolAlerts();
    res.json({ alerts, thresholds: THRESHOLDS });
  } catch (error) {
    console.error("❌ Admin pool alerts error:", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

/*
 * GET /api/admin/pools/:eventId/contributions
 * Détail des contributions d'une cagnotte (identités visibles — usage admin only).
 */
router.get("/:eventId/contributions", async (req, res) => {
  try {
    const event = await Event.findById(req.params.eventId)
      .select("shortId title giftPool organizer")
      .populate("organizer", "name surname email");
    if (!event) return res.status(404).json({ message: "Événement introuvable" });

    const contributions = await GiftPoolContribution.find({ event: event._id })
      .populate("contributor", "name surname email")
      .sort({ createdAt: -1 });

    res.json({ event, contributions });
  } catch (error) {
    console.error("❌ Admin pool contributions error:", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

/*
 * POST /api/admin/pools/contributions/:contributionId/refund
 * Rembourse une contribution via Stripe (sur le compte Connect de l'organisateur).
 */
router.post("/contributions/:contributionId/refund", async (req, res) => {
  try {
    const contribution = await GiftPoolContribution.findById(
      req.params.contributionId,
    ).populate("event", "organizer shortId title");
    if (!contribution)
      return res.status(404).json({ message: "Contribution introuvable" });
    if (contribution.status !== "succeeded")
      return res.status(400).json({
        message: `Seules les contributions encaissées peuvent être remboursées (statut actuel : ${contribution.status}).`,
      });

    const account = await StripeAccount.findOne({
      user: contribution.event.organizer,
    });
    if (!account)
      return res
        .status(400)
        .json({ message: "Compte Stripe de l'organisateur introuvable." });

    // Remboursement sur le compte Connect (la charge était directe)
    const refund = await stripe.refunds.create(
      { payment_intent: contribution.stripePaymentIntentId },
      { stripeAccount: account.stripeAccountId },
    );

    contribution.status = "refunded";
    await contribution.save();

    console.log(
      `↩️ Admin refund: contribution ${contribution._id} (event ${contribution.event.shortId}) — refund ${refund.id} par admin ${req.payload._id}`,
    );

    res.json({ message: "Contribution remboursée", refundId: refund.id, contribution });
  } catch (error) {
    console.error("❌ Admin refund error:", error);
    const stripeMsg = error?.raw?.message || error?.message;
    res.status(500).json({ message: `Erreur lors du remboursement : ${stripeMsg}` });
  }
});

module.exports = router;
