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

    // Pas encore de compte Connect -> on en crée un.
    //
    // ⚠️ Propriétés de contrôle explicites, et NON `type: "express"`.
    //
    // Le point qui compte est `losses.payments`. Un compte créé avec
    // `type: "express"` le fixe à "application" : quand un remboursement ou
    // une opposition fait passer le compte d'un organisateur en négatif et que
    // Stripe ne parvient à se rembourser ni sur son solde ni sur sa banque, la
    // perte remonte à BirthReminder — une réserve est retenue sur notre solde,
    // puis ponctionnée après 180 jours. Nous paierions donc de l'argent que
    // nous n'avons jamais encaissé, sur une cagnotte dont nous ne prenons
    // aucune commission.
    //
    // Stripe recommande lui-même "stripe" pour les charges directes, et pour
    // cette raison précise : en charge directe, les remboursements viennent
    // réduire directement le solde du compte connecté, donc le risque de
    // négatif y est structurellement plus élevé qu'ailleurs.
    //
    // Le reste reproduit exactement le comportement Express précédent, pour
    // que le parcours d'inscription de l'organisateur soit inchangé :
    //  - stripe_dashboard.type "express" → même tableau de bord hébergé
    //  - requirement_collection "stripe" → Stripe continue de faire le KYC
    //  - fees.payer "account"            → l'organisateur paie les frais Stripe,
    //    ce que le code suppose déjà en lisant `balance_transaction.fee` sur
    //    SON compte (voir stripe.webhook.js)
    //
    // ⚠️ Cette configuration est IMMUABLE une fois le compte créé : le type de
    // tableau de bord ne se change pas, il faut créer un autre compte. Ne pas
    // modifier ce bloc sans mesurer qu'il ne vaudra que pour les NOUVEAUX
    // comptes, jamais pour ceux déjà onboardés.
    //
    // ⚠️ `stripeAccount.type` vaudra "none" : cette combinaison ne correspond à
    // aucun des trois types historiques. Ne jamais brancher de logique sur
    // `type` — utiliser `controller.losses.payments` si le besoin se présente.
    if (!account) {
      const stripeAccount = await stripe.accounts.create({
        country: "FR",
        controller: {
          losses: { payments: "stripe" },
          fees: { payer: "account" },
          requirement_collection: "stripe",
          stripe_dashboard: { type: "express" },
        },
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
/*
 * POST /api/stripe/connect/dashboard
 * Lien de connexion à usage unique vers le tableau de bord Express.
 *
 * ⚠️ C'est la réponse à « comment je récupère l'argent de ma cagnotte ? ».
 *
 * En charges directes, les fonds arrivent sur le compte Stripe de
 * l'organisateur et sont virés automatiquement sur son compte bancaire selon
 * le calendrier de Stripe : il n'a, en principe, rien à faire. Mais il n'avait
 * jusqu'ici AUCUN moyen depuis l'application de voir son solde, ses virements
 * ou de changer son RIB — il fallait retrouver un vieil email de Stripe. Un
 * organisateur qui ne voit pas son argent nous écrit, ou pire, doute.
 *
 * Le lien expire vite et ne s'envoie jamais par email : il ouvre une session
 * authentifiée, il ne se partage pas.
 */
router.post("/dashboard", isAuthenticated, async (req, res) => {
  try {
    const account = await StripeAccount.findOne({ user: req.payload._id });
    if (!account) {
      return res
        .status(404)
        .json({ message: "Aucun compte de paiement associé à ce profil." });
    }

    // Stripe refuse le lien tant que l'onboarding n'est pas terminé : le
    // message doit dire quoi faire, pas afficher une erreur brute.
    const link = await stripe.accounts.createLoginLink(account.stripeAccountId);
    res.status(200).json({ url: link.url });
  } catch (error) {
    console.error("❌ Error creating Stripe login link:", error);
    res.status(400).json({
      message:
        "Votre compte de paiement n'est pas encore finalisé. Terminez la " +
        "configuration Stripe avant d'accéder au tableau de bord.",
    });
  }
});

/*
 * GET /api/stripe/connect/balance
 * Solde et prochain virement, pour l'afficher dans l'application.
 *
 * Évite l'aller-retour vers Stripe quand l'organisateur veut juste savoir
 * « où en est mon argent ». Le détail complet reste sur le tableau de bord.
 */
router.get("/balance", isAuthenticated, async (req, res) => {
  try {
    const account = await StripeAccount.findOne({ user: req.payload._id });
    if (!account) return res.status(200).json({ connected: false });

    const sum = (arr) =>
      (arr || [])
        .filter((b) => b.currency === "eur")
        .reduce((t, b) => t + b.amount, 0);

    const balance = await stripe.balance.retrieve(
      {},
      { stripeAccount: account.stripeAccountId },
    );

    // Virements récents, pour dire « versé le … » plutôt qu'un solde nu qui
    // inquiète : un solde à zéro veut souvent dire « déjà sur votre banque ».
    let payouts = [];
    try {
      const list = await stripe.payouts.list(
        { limit: 5 },
        { stripeAccount: account.stripeAccountId },
      );
      payouts = list.data.map((p) => ({
        id: p.id,
        amount: p.amount,
        status: p.status,
        arrivalDate: p.arrival_date ? new Date(p.arrival_date * 1000) : null,
      }));
    } catch (_) {}

    res.status(200).json({
      connected: true,
      availableCents: sum(balance.available),
      pendingCents: sum(balance.pending),
      payouts,
    });
  } catch (error) {
    console.error("❌ Error fetching Connect balance:", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

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
