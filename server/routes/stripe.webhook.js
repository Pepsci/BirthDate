const express = require("express");
const router = express.Router();
const stripe = require("../config/stripe.config");
const StripeAccount = require("../models/stripeAccount.model");
const GiftPoolContribution = require("../models/giftPoolContribution.model");
const Event = require("../models/event.model");
const User = require("../models/user.model");
const { notify } = require("../utils/notify");
const {
  sendContributionReceiptEmail,
} = require("../services/emailTemplates/contributionReceiptEmail");

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

        // ── Frais réels prélevés par Stripe ────────────────────────────────
        // On les lit maintenant, une fois, et on les fige. Les estimer à
        // partir d'une constante ne marche que pour une carte européenne
        // standard ; une carte professionnelle, britannique ou hors Europe
        // coûte nettement plus, et c'est ce chiffre qu'on montre à
        // l'organisateur avant un remboursement irréversible.
        //
        // ⚠️ Charges directes : la charge et sa `balance_transaction` vivent
        // sur le compte de l'ORGANISATEUR, pas sur le nôtre. Sans l'en-tête
        // `stripeAccount`, Stripe répond « ressource introuvable ».
        //
        // Jamais bloquant : le paiement est encaissé et le contributeur
        // notifié quoi qu'il arrive. Sans ce champ, le remboursement
        // retombera simplement sur l'estimation.
        if (contribution.feeCents == null) {
          try {
            const connectedAccountId = event.account || null;
            const chargeId =
              typeof pi.latest_charge === "string"
                ? pi.latest_charge
                : pi.latest_charge?.id;
            if (chargeId) {
              const charge = await stripe.charges.retrieve(
                chargeId,
                { expand: ["balance_transaction"] },
                connectedAccountId
                  ? { stripeAccount: connectedAccountId }
                  : undefined,
              );
              const fee = charge?.balance_transaction?.fee;
              if (typeof fee === "number") {
                contribution.feeCents = fee;
                await contribution.save();
              }
            }
          } catch (err) {
            console.error(
              `[stripe.webhook] frais réels illisibles pour ${pi.id}:`,
              err.message,
            );
          }
        }

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

        // c) Accusé de réception au CONTRIBUTEUR — sa preuve de paiement.
        //
        // ⚠️ Ne dépend pas des préférences de l'organisateur : ce mail ne lui
        // appartient pas. C'est la seule trace que gardera un contributeur sans
        // compte, et le document qu'il produira le jour où il réclamera son
        // remboursement. Le reçu automatique de Stripe ne suffit pas : sur une
        // charge directe il est émis par le compte de l'organisateur et suit
        // SES réglages, qu'on ne maîtrise pas.
        //
        // Jamais bloquant, et jamais envoyé deux fois : Stripe rejoue ses
        // webhooks, `receiptSentAt` fait garde-fou.
        if (!contribution.receiptSentAt) {
          try {
            let to = contribution.guestEmail || null;
            let toName = contribution.guestName || null;
            if (contribution.contributor) {
              const u = await User.findById(
                contribution.contributor,
                "name email",
              );
              if (u?.email) {
                to = u.email;
                toName = toName || u.name || null;
              }
            }

            if (to) {
              const org = await User.findById(
                eventDoc.organizer,
                "name surname",
              );
              const organizerName = org
                ? `${org.name}${org.surname ? " " + org.surname : ""}`
                : "l'organisateur";

              await sendContributionReceiptEmail({
                email: to,
                guestName: toName,
                amount: contribution.amount,
                eventTitle: eventDoc.title,
                eventShortId: eventDoc.shortId,
                organizerName,
                reference: contribution.stripePaymentIntentId,
                paidAt: contribution.updatedAt || new Date(),
              });

              contribution.receiptSentAt = new Date();
              await contribution.save();
            }
          } catch (err) {
            console.error(
              `[stripe.webhook] reçu contributeur non envoyé pour ${pi.id}:`,
              err.message,
            );
          }
        }

        break;
      }

      /*
       * Remboursement confirmé par Stripe.
       *
       * ⚠️ C'est ICI, et nulle part ailleurs, qu'une contribution passe en
       * "refunded" — la route /pool/refund-all se contente de demander le
       * remboursement. Même principe que l'encaissement : le front et nos
       * routes demandent, Stripe confirme, et seule la confirmation fait foi.
       *
       * Idempotent : findOneAndUpdate sur un identifiant unique, donc un rejeu
       * du webhook par Stripe ne produit aucun effet supplémentaire.
       */
      case "charge.refunded": {
        const charge = event.data.object;
        const piId =
          typeof charge.payment_intent === "string"
            ? charge.payment_intent
            : charge.payment_intent?.id;
        if (!piId) break;

        const contribution = await GiftPoolContribution.findOneAndUpdate(
          { stripePaymentIntentId: piId },
          { status: "refunded", refundedAt: new Date() },
          { new: true },
        );
        if (!contribution) break;

        const eventDoc = await Event.findById(contribution.event).select(
          "title shortId",
        );

        // Le contributeur est prévenu — c'est son argent.
        //
        // ⚠️ Un invité externe (contributor null) n'a pas de compte, donc pas
        // de notification in-app. On compte pour lui sur l'avis de
        // remboursement de Stripe, envoyé à l'adresse du reçu (`guestEmail`,
        // désormais toujours renseignée). Ce n'est pas une garantie : sur une
        // charge directe, ces emails suivent les réglages du compte de
        // l'ORGANISATEUR, qui peut les avoir coupés. TODO : notre propre avis
        // de remboursement, sur le modèle de contributionReceiptEmail.
        if (contribution.contributor && eventDoc) {
          await notify(req.app, {
            userId: contribution.contributor,
            type: "event_pool_refunded",
            data: {
              eventTitle: eventDoc.title,
              eventShortId: eventDoc.shortId,
              amount: contribution.amount,
              message: `Ta contribution à « ${eventDoc.title} » t'a été remboursée intégralement.`,
            },
            link: `/event/${eventDoc.shortId}`,
          });
        }

        if (eventDoc) {
          req.app
            .get("io")
            ?.to(`event:${eventDoc.shortId}`)
            .emit("event:pool_update", { shortId: eventDoc.shortId });
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
