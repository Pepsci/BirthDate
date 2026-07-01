const express = require("express");
const router = express.Router();
const stripe = require("../config/stripe.config");
const StripeAccount = require("../models/stripeAccount.model");
const { isAuthenticated } = require("../middleware/jwt.middleware");

const FALLBACK = process.env.FRONTEND_URL || "https://birthreminder.com";
const RETURN_URL =
  process.env.STRIPE_CONNECT_RETURN_URL || `${FALLBACK}/events/mine`;
const REFRESH_URL =
  process.env.STRIPE_CONNECT_REFRESH_URL || `${FALLBACK}/events/mine`;

// Domaine à enregistrer pour Apple Pay (extrait du FRONTEND_URL, sans protocole)
const APPLE_PAY_DOMAIN = FALLBACK.replace(/^https?:\/\//, "").replace(
  /\/$/,
  "",
);

/*
 * Enregistre le domaine Apple Pay SUR un compte connecté.
 * Requis en charges directes : la session Apple Pay s'exécute sur le compte
 * de l'organisateur, qui doit donc "connaître" le domaine. Idempotent :
 * on ignore l'erreur si le domaine est déjà enregistré.
 */
async function registerApplePayDomain(stripeAccountId) {
  try {
    await stripe.applePayDomains.create(
      { domain_name: APPLE_PAY_DOMAIN },
      { stripeAccount: stripeAccountId },
    );
    console.log(
      `✅ Apple Pay domain '${APPLE_PAY_DOMAIN}' registered on ${stripeAccountId}`,
    );
  } catch (err) {
    const msg = String(err?.message || "");
    // Déjà enregistré -> pas une vraie erreur
    if (!msg.toLowerCase().includes("already")) {
      console.error("⚠️ Apple Pay domain registration failed:", msg);
    }
  }
}

/*
 * POST /api/stripe/connect/onboard
 * Crée (ou réutilise) le compte Express de l'organisateur et renvoie
 * un lien d'onboarding Stripe hébergé. Le compte est unique par user et
 * réutilisé sur tous ses événements.
 */
router.post("/onboard", isAuthenticated, async (req, res) => {
  try {
    const userId = req.payload._id;
    let account = await StripeAccount.findOne({ user: userId });

    // Pas encore de compte Connect -> on en crée un (type Express)
    if (!account) {
      const stripeAccount = await stripe.accounts.create({
        type: "express",
        country: "FR",
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        business_type: "individual",
        metadata: { birthReminderUserId: String(userId) },
      });

      account = await StripeAccount.create({
        user: userId,
        stripeAccountId: stripeAccount.id,
      });
    }

    // Lien d'onboarding hébergé par Stripe (usage unique, courte durée de vie)
    const accountLink = await stripe.accountLinks.create({
      account: account.stripeAccountId,
      refresh_url: REFRESH_URL,
      return_url: RETURN_URL,
      type: "account_onboarding",
    });

    res.status(200).json({ url: accountLink.url });
  } catch (error) {
    console.error("❌ Error creating Connect onboarding link:", error);
    res
      .status(500)
      .json({ message: "Erreur lors de la création du lien Stripe" });
  }
});

/*
 * GET /api/stripe/connect/status
 * Renvoie l'état du compte Connect, synchronisé depuis Stripe.
 * `ready: true` => l'organisateur peut encaisser une cagnotte.
 */
router.get("/status", isAuthenticated, async (req, res) => {
  try {
    const userId = req.payload._id;
    const account = await StripeAccount.findOne({ user: userId });

    if (!account) {
      return res.status(200).json({ connected: false, ready: false });
    }

    // Source de vérité = Stripe ; on rafraîchit la copie locale
    const stripeAccount = await stripe.accounts.retrieve(
      account.stripeAccountId,
    );

    const wasReady = account.chargesEnabled && account.detailsSubmitted;

    account.chargesEnabled = stripeAccount.charges_enabled;
    account.payoutsEnabled = stripeAccount.payouts_enabled;
    account.detailsSubmitted = stripeAccount.details_submitted;
    if (stripeAccount.details_submitted && !account.onboardingCompletedAt) {
      account.onboardingCompletedAt = new Date();
    }
    await account.save();

    const isReady = account.chargesEnabled && account.detailsSubmitted;

    // Le compte est prêt : on s'assure que le domaine Apple Pay est enregistré
    // sur ce compte connecté (idempotent, requis en charges directes).
    if (isReady) {
      await registerApplePayDomain(account.stripeAccountId);
    }

    res.status(200).json({
      connected: true,
      chargesEnabled: account.chargesEnabled,
      payoutsEnabled: account.payoutsEnabled,
      detailsSubmitted: account.detailsSubmitted,
      ready: isReady,
    });
  } catch (error) {
    console.error("❌ Error fetching Connect status:", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

module.exports = router;
