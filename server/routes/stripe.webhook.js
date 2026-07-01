const express = require("express");
const router = express.Router();
const stripe = require("../config/stripe.config");
const StripeAccount = require("../models/stripeAccount.model");
const GiftPoolContribution = require("../models/giftPoolContribution.model");
const Event = require("../models/event.model");
const User = require("../models/user.model");
const { notify } = require("../utils/notify");

/*
 * POST /api/stripe/webhook
 * ⚠️ Monté avec express.raw() AVANT express.json() dans app.js.
 * Signature vérifiée sur le body BRUT. Handlers idempotents.
 */
router.post("/", async (req, res) => {
  const sig = req.headers["stripe-signature"];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET,
    );
  } catch (err) {
    console.error("❌ Webhook signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case "account.updated": {
        const acct = event.data.object;
        await StripeAccount.findOneAndUpdate(
          { stripeAccountId: acct.id },
          {
            chargesEnabled: acct.charges_enabled,
            payoutsEnabled: acct.payouts_enabled,
            detailsSubmitted: acct.details_submitted,
            ...(acct.details_submitted
              ? { onboardingCompletedAt: new Date() }
              : {}),
          },
        );
        break;
      }

      case "payment_intent.succeeded": {
        const pi = event.data.object;

        // Passe la contribution à succeeded (idempotent)
        const contribution = await GiftPoolContribution.findOneAndUpdate(
          { stripePaymentIntentId: pi.id },
          { status: "succeeded" },
          { new: true },
        );

        // Si pas trouvée (ex: trigger CLI générique), on s'arrête là proprement
        if (!contribution) break;

        const eventDoc = await Event.findById(contribution.event).select(
          "shortId title organizer organizerNotificationPrefs",
        );
        if (!eventDoc) break;

        // a) Temps réel : signale au widget de se rafraîchir
        const io = req.app.get("io");
        if (io) {
          io.to(`event:${eventDoc.shortId}`).emit("event:pool_update", {
            shortId: eventDoc.shortId,
          });
        }

        // b) Notifier l'organisateur (selon ses préférences)
        const prefs = eventDoc.organizerNotificationPrefs || {};
        if (prefs.poolContribution !== false) {
          // Nom du contributeur (compte ou invité)
          let contributorName = contribution.guestName || "Quelqu'un";
          if (contribution.contributor) {
            const u = await User.findById(
              contribution.contributor,
              "name surname",
            );
            if (u) {
              contributorName = `${u.name}${u.surname ? " " + u.surname : ""}`;
            }
          }
          if (contribution.anonymous) contributorName = "Un participant";

          const amountEuros = (contribution.amount / 100).toLocaleString(
            "fr-FR",
            { style: "currency", currency: "EUR" },
          );

          await notify(req.app, {
            userId: eventDoc.organizer.toString(),
            type: "event_pool_contribution",
            data: {
              eventShortId: eventDoc.shortId,
              eventTitle: eventDoc.title,
              contributorName,
              amount: contribution.amount,
              amountLabel: amountEuros,
            },
            link: `/event/${eventDoc.shortId}`,
          });
        }

        break;
      }

      case "payment_intent.payment_failed": {
        const pi = event.data.object;
        await GiftPoolContribution.findOneAndUpdate(
          { stripePaymentIntentId: pi.id },
          { status: "failed" },
        );
        break;
      }

      default:
        break;
    }

    res.status(200).json({ received: true });
  } catch (error) {
    console.error("❌ Error handling webhook event:", error);
    res.status(500).json({ received: false });
  }
});

module.exports = router;
