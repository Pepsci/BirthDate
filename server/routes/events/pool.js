const express = require("express");
const router = express.Router();
const stripe = require("../../config/stripe.config");
const Event = require("../../models/event.model");
const User = require("../../models/user.model");
const StripeAccount = require("../../models/stripeAccount.model");
const GiftPoolContribution = require("../../models/giftPoolContribution.model");
const { isAuthenticated } = require("../../middleware/jwt.middleware");

// Montant min/max d'une contribution (centimes) — garde-fous
const MIN_AMOUNT = 100; // 1 €
const MAX_AMOUNT = 1000000; // 10 000 €

/*
 * GET /api/events/:shortId/pool
 * État de la cagnotte + total collecté + contributions (publiques).
 * Accessible sans auth (page publique de l'événement).
 */
router.get("/:shortId/pool", async (req, res) => {
  try {
    const event = await Event.findOne({ shortId: req.params.shortId });
    if (!event)
      return res.status(404).json({ message: "Événement introuvable" });

    const pool = event.giftPool || {};
    if (!pool.active) {
      return res.status(200).json({ active: false });
    }

    // Total réellement encaissé (statut succeeded uniquement)
    const contributions = await GiftPoolContribution.find({
      event: event._id,
      status: "succeeded",
    })
      .populate("contributor", "name surname avatar")
      .sort({ createdAt: -1 });

    const totalCollected = contributions.reduce((sum, c) => sum + c.amount, 0);

    res.status(200).json({
      active: true,
      mode: pool.mode,
      goal: pool.goal,
      currency: pool.currency || "eur",
      deadline: pool.deadline,
      totalCollected,
      contributionsCount: contributions.length,
      contributions: contributions.map((c) => ({
        id: c._id,
        amount: c.amount,
        message: c.message,
        createdAt: c.createdAt,
        contributor: c.anonymous
          ? null
          : c.contributor
            ? {
                name: c.contributor.name,
                surname: c.contributor.surname,
                avatar: c.contributor.avatar,
              }
            : { name: c.guestName || "Invité", surname: "", avatar: null },
      })),
    });
  } catch (error) {
    console.error("❌ Error fetching gift pool:", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

/*
 * PUT /api/events/:shortId/pool
 * Activer / configurer / désactiver la cagnotte (organizer only).
 * Body: { active, mode, goal, deadline }
 */
router.put("/:shortId/pool", isAuthenticated, async (req, res) => {
  try {
    const event = await Event.findOne({ shortId: req.params.shortId });
    if (!event)
      return res.status(404).json({ message: "Événement introuvable" });
    if (event.organizer.toString() !== req.payload._id)
      return res.status(403).json({ message: "Non autorisé" });

    const { active, mode, goal, deadline } = req.body;

    // Pour activer, on vérifie que l'organisateur peut encaisser
    if (active) {
      const account = await StripeAccount.findOne({ user: req.payload._id });
      if (!account || !account.chargesEnabled) {
        return res.status(400).json({
          code: "STRIPE_NOT_READY",
          message:
            "Vous devez d'abord connecter votre compte Stripe pour activer la cagnotte.",
        });
      }
    }

    const current = event.giftPool || {};
    const nextMode = mode || current.mode || "free";

    event.giftPool = {
      active: active !== undefined ? active : current.active,
      mode: nextMode,
      goal: nextMode === "goal" ? (goal ? Number(goal) : current.goal) : null,
      currency: current.currency || "eur",
      deadline:
        deadline !== undefined ? deadline || null : current.deadline || null,
    };

    // On garde le flag legacy aligné pour l'UI existante
    event.giftPoolEnabled = event.giftPool.active;

    await event.save();
    res.status(200).json(event.giftPool);
  } catch (error) {
    console.error("❌ Error updating gift pool:", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

/*
 * POST /api/events/:shortId/pool/contribute
 * Crée un PaymentIntent en CHARGE DIRECTE sur le compte de l'organisateur.
 * Renvoie le client_secret pour Stripe Elements côté front.
 * Accessible sans auth (les invités externes peuvent contribuer).
 * Body: { amount (centimes), message?, anonymous?, guestName? }
 */
router.post("/:shortId/pool/contribute", async (req, res) => {
  try {
    const event = await Event.findOne({ shortId: req.params.shortId });
    if (!event)
      return res.status(404).json({ message: "Événement introuvable" });

    const pool = event.giftPool || {};
    if (!pool.active) {
      return res
        .status(400)
        .json({ message: "La cagnotte n'est pas active pour cet événement." });
    }

    const { amount, message, anonymous, guestName } = req.body;
    const amountInt = Number(amount);

    if (
      !Number.isInteger(amountInt) ||
      amountInt < MIN_AMOUNT ||
      amountInt > MAX_AMOUNT
    ) {
      return res.status(400).json({
        message: `Le montant doit être compris entre ${MIN_AMOUNT / 100} € et ${MAX_AMOUNT / 100} €.`,
      });
    }

    // Compte Connect de l'organisateur
    const account = await StripeAccount.findOne({ user: event.organizer });
    if (!account || !account.chargesEnabled) {
      return res.status(400).json({
        message:
          "L'organisateur ne peut pas encaisser de paiements pour le moment.",
      });
    }

    // Identifier le contributeur connecté si présent (cookie/header), sinon invité
    let contributorId = null;
    const jwt = require("jsonwebtoken");
    const token =
      req.headers.authorization?.split(" ")[1] || req.cookies?.authToken;
    if (token) {
      try {
        contributorId = jwt.verify(token, process.env.TOKEN_SECRET)._id;
      } catch (_) {}
    }

    // Email pour le reçu Stripe : récupéré du compte si l'utilisateur est connecté.
    // Pour un invité, Stripe collecte l'email via le PaymentElement (pas besoin ici).
    let receiptEmail = null;
    if (contributorId) {
      const u = await User.findById(contributorId).select("email");
      if (u?.email) receiptEmail = u.email;
    }

    // PaymentIntent créé SUR le compte de l'organisateur (charge directe)
    const paymentIntent = await stripe.paymentIntents.create(
      {
        amount: amountInt,
        currency: pool.currency || "eur",
        automatic_payment_methods: {
          enabled: true,
          allow_redirects: "never",
        },
        ...(receiptEmail ? { receipt_email: receiptEmail } : {}),
        metadata: {
          eventShortId: event.shortId,
          eventId: String(event._id),
          contributorId: contributorId ? String(contributorId) : "",
          guestName: guestName || "",
        },
        // Quand tu voudras une commission BirthReminder, ajoute ici :
        // application_fee_amount: Math.round(amountInt * 0.01),
      },
      {
        stripeAccount: account.stripeAccountId, // ← charge directe
      },
    );

    // Trace la contribution en pending ; le webhook la passera à succeeded
    await GiftPoolContribution.create({
      event: event._id,
      contributor: contributorId,
      guestName: contributorId ? undefined : guestName,
      amount: amountInt,
      currency: pool.currency || "eur",
      message: message || undefined,
      anonymous: anonymous === true,
      stripePaymentIntentId: paymentIntent.id,
      status: "pending",
    });

    res.status(200).json({
      clientSecret: paymentIntent.client_secret,
      stripeAccountId: account.stripeAccountId, // requis par Elements en charge directe
    });
  } catch (error) {
    console.error("❌ Error creating contribution PaymentIntent:", error);
    res.status(500).json({ message: "Erreur lors de la création du paiement" });
  }
});

module.exports = router;
