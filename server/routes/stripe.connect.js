const express = require("express");
const router = express.Router();
const stripe = require("../config/stripe.config");
const StripeAccount = require("../models/stripeAccount.model");
const Event = require("../models/event.model");
const GiftPoolContribution = require("../models/giftPoolContribution.model");
const { audit } = require("../services/auditLog");
const { isAuthenticated } = require("../middleware/jwt.middleware");

const FALLBACK = process.env.FRONTEND_URL || "https://birthreminder.com";

/**
 * Adresse PUBLIQUE du site, pour `business_profile.url`.
 *
 * ⚠️ Volontairement distincte de FRONTEND_URL, qui vaut « http://localhost:5173 »
 * en développement. Stripe refuse une adresse non publique dans le profil
 * d'activité — c'est une information destinée à ses équipes de conformité, pas
 * une URL de redirection. Utiliser FRONTEND_URL ici faisait échouer toute
 * création de compte en local, avec un message générique côté application.
 *
 * Les URL de retour et de rafraîchissement, elles, peuvent rester en localhost :
 * Stripe l'autorise explicitement en mode test.
 */
const PUBLIC_SITE_URL =
  process.env.PUBLIC_SITE_URL ||
  (/^https:\/\//.test(FALLBACK) ? FALLBACK : "https://birthreminder.com");
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

    // Pas encore de compte Connect -> on en crée un (Standard).
    //
    // ⚠️ ARBITRAGE, et il a coûté une erreur en production le 14/09/2026.
    //
    // Nous avons d'abord tenté de garder le tableau de bord Express tout en
    // confiant les pertes à Stripe (`controller.losses.payments = "stripe"`).
    // Stripe REFUSE cette combinaison :
    //
    //   « When stripe_dashboard[type]=express, your platform must collect fees
    //     and be liable for negative balances or refunds and chargebacks. »
    //
    // Le tableau de bord Express hébergé se paie par la responsabilité des
    // pertes : les deux ne se dissocient pas. Le choix réel était donc binaire.
    //
    //   Express  : onboarding plus doux, mais un solde négatif irrécouvrable
    //              sur un compte connecté est à NOTRE charge (réserve retenue
    //              sur notre solde, ponction après 180 jours). Nous paierions
    //              de l'argent jamais encaissé, sur une cagnotte sans
    //              commission.
    //   Standard : Stripe porte cette perte. L'organisateur obtient un vrai
    //              compte Stripe et son tableau de bord complet.
    //
    // Standard retenu : une marche plus haute à l'inscription se rattrape,
    // une exposition financière structurelle ne se compense jamais tout à
    // fait par des garde-fous.
    //
    // Ce qui ne change PAS : les charges restent directes, donc les invités
    // continuent de payer dans BirthReminder sans jamais voir Stripe. Le type
    // de compte ne concerne que l'organisateur.
    //
    // ⚠️ Conséquences ailleurs dans le code :
    //   - `accounts.createLoginLink` ne fonctionne QUE pour Express : la route
    //     /dashboard renvoie donc dashboard.stripe.com pour un Standard.
    //   - Le délai de virement et la suspension des paiements ne nous sont
    //     plus accessibles (réservés aux plateformes responsables).
    //   - Les informations KYC deviennent illisibles pour la plateforme après
    //     le premier account link : le dossier de preuve s'appuie sur nos
    //     propres données, pas sur l'identité vérifiée par Stripe.
    //
    // ⚠️ Les comptes Express déjà créés gardent leur configuration à vie : le
    // code doit continuer de gérer les deux types.
    if (!account) {
      const stripeAccount = await stripe.accounts.create({
        type: "standard",
        country: "FR",
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        business_type: "individual",

        // ── Profil d'activité prérempli ───────────────────────────────────
        //
        // ⚠️ Sans ça, l'onboarding Standard est inutilisable pour notre public.
        //
        // Le formulaire hébergé par Stripe demande « un site web présentant les
        // produits ou services que vous vendez » et « décrivez votre entreprise
        // en 2 ou 3 phrases ». Notre organisateur type est un particulier qui
        // collecte 60 € pour l'anniversaire d'un ami : il n'a ni site, ni
        // produit, ni entreprise. À cet écran, il abandonne.
        //
        // Connect Onboarding ne redemande pas ce qui est déjà renseigné sur
        // l'objet Account. On décrit donc l'activité à sa place — ce qui est
        // honnête : cette activité se déroule bien sur birthreminder.com, et
        // c'est nous qui savons la décrire.
        //
        // ⚠️ À renseigner AVANT le premier account link : passé ce point, la
        // plateforme ne peut plus écrire les informations d'un compte Standard.
        business_profile: {
          url: PUBLIC_SITE_URL,
          // 5947 « Gift, Card, Novelty and Souvenir Shops » : le code le plus
          // proche d'une collecte destinée à l'achat d'un cadeau. Aucun code
          // ne décrit exactement un particulier qui organise une cagnotte —
          // à confirmer avec le support Stripe si un contrôle survient.
          mcc: "5947",
          product_description:
            "Collecte participative entre particuliers organisée sur " +
            "BirthReminder pour financer un cadeau commun (anniversaire, " +
            "départ, naissance). Les participants sont des proches invités " +
            "par l'organisateur ; aucun bien n'est vendu.",
        },

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
    // ⚠️ Remonter la raison réelle. Un « Erreur lors de la création du lien »
    // générique laisse totalement aveugle : le message de Stripe dit
    // précisément quel champ pose problème, et sans lui il faut fouiller les
    // logs serveur pour une cause souvent triviale (URL non publique, code
    // d'activité refusé…).
    const stripeMsg = error?.raw?.message || error?.message;
    res.status(500).json({
      message: "Erreur lors de la création du lien Stripe",
      detail: stripeMsg || null,
    });
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

    // ⚠️ `createLoginLink` ne fonctionne QUE pour les comptes Express.
    //
    // Un compte Standard a son propre compte Stripe : il s'y connecte
    // directement, et la plateforme n'a pas à lui fabriquer de session. Les
    // deux types coexistent chez nous — les comptes Express créés avant la
    // bascule gardent leur configuration à vie — donc on regarde le compte
    // avant de choisir.
    const acct = await stripe.accounts.retrieve(account.stripeAccountId);
    const hasExpressDashboard =
      acct.type === "express" ||
      acct.controller?.stripe_dashboard?.type === "express";

    console.log(
      `[connect] dashboard demandé pour ${account.stripeAccountId} — ` +
        `type=${acct.type || "none"} dashboard=${acct.controller?.stripe_dashboard?.type || "?"} ` +
        `details_submitted=${acct.details_submitted}`,
    );

    if (hasExpressDashboard) {
      // ⚠️ Stripe refuse le lien de session tant que l'onboarding n'est pas
      // terminé. On le vérifie AVANT d'appeler, pour distinguer ce cas — qui
      // est normal et appelle une action de l'utilisateur — d'une vraie panne.
      if (!acct.details_submitted) {
        return res.status(400).json({
          code: "ONBOARDING_INCOMPLETE",
          message:
            "Votre compte de paiement n'est pas encore finalisé. Terminez la " +
            "configuration Stripe avant d'accéder au tableau de bord.",
        });
      }
      const link = await stripe.accounts.createLoginLink(
        account.stripeAccountId,
      );
      return res.status(200).json({ url: link.url, kind: "express" });
    }

    // Standard : le tableau de bord Stripe, avec ses propres identifiants.
    res.status(200).json({
      url: "https://dashboard.stripe.com/",
      kind: "standard",
    });
  } catch (error) {
    console.error("❌ Error creating Stripe login link:", error);
    // ⚠️ Ne plus masquer la cause derrière un message d'onboarding : le cas
    // « onboarding incomplet » est traité explicitement plus haut, donc toute
    // exception qui arrive ici est autre chose. Afficher « finalisez votre
    // configuration » pour une panne réelle envoie chercher au mauvais endroit.
    res.status(500).json({
      message: "Impossible d'ouvrir votre tableau de bord Stripe.",
      detail: error?.raw?.message || error?.message || null,
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

/*
 * DELETE /api/stripe/connect/account
 * Déconnecte le compte de paiement de l'organisateur.
 *
 * ⚠️ Ce n'est pas une fonction de confort : sans elle, un organisateur qui a
 * ouvert un compte Stripe une fois n'avait aucun moyen de revenir en arrière
 * depuis l'application. Avec des comptes Standard — donc de vrais comptes
 * Stripe appartenant à l'utilisateur — pouvoir couper le lien est une attente
 * légitime, et le refuser serait difficilement défendable.
 *
 * Deux garde-fous, dans cet ordre :
 *
 *   1. On refuse tant qu'il reste des contributions encaissées non
 *      remboursées. Couper le lien rendrait tout remboursement impossible
 *      depuis l'application, alors que l'organisateur reste tenu de rendre
 *      cet argent. C'est le même refus que pour la suppression d'un événement.
 *
 *   2. On désactive les cagnottes encore ouvertes. Laisser une cagnotte
 *      active sans compte pour encaisser produirait des erreurs de paiement
 *      incompréhensibles pour les invités.
 *
 * La suppression du compte CHEZ Stripe est tentée mais jamais exigée : en mode
 * live, Stripe interdit à une plateforme de supprimer un compte Standard. Ce
 * qui compte ici, c'est de retirer le lien de notre côté.
 */
router.delete("/account", isAuthenticated, async (req, res) => {
  try {
    const userId = req.payload._id;
    const account = await StripeAccount.findOne({ user: userId });
    if (!account) {
      return res.status(404).json({ message: "Aucun compte à déconnecter." });
    }

    const events = await Event.find({ organizer: userId }).select("_id shortId");
    const eventIds = events.map((e) => e._id);

    const live = await GiftPoolContribution.countDocuments({
      event: { $in: eventIds },
      status: "succeeded",
    });
    if (live > 0) {
      return res.status(409).json({
        code: "POOL_NOT_SETTLED",
        message:
          `Vous avez ${live} contribution${live > 1 ? "s" : ""} encaissée${live > 1 ? "s" : ""} ` +
          `et non remboursée${live > 1 ? "s" : ""}. Remboursez vos participants avant de ` +
          "déconnecter votre compte : une fois le lien coupé, aucun remboursement " +
          "ne sera plus possible depuis l'application.",
      });
    }

    // Aucune cagnotte ne doit rester ouverte sans compte pour l'encaisser.
    const closed = await Event.updateMany(
      { organizer: userId, "giftPool.active": true },
      { $set: { "giftPool.active": false } },
    );

    let deletedAtStripe = false;
    try {
      await stripe.accounts.del(account.stripeAccountId);
      deletedAtStripe = true;
    } catch (err) {
      // Attendu pour un compte Standard en mode live : Stripe refuse qu'une
      // plateforme supprime un compte ayant accès au tableau de bord complet.
      // Le compte reste chez Stripe, rattaché à personne.
      console.log(
        `[connect] compte ${account.stripeAccountId} non supprimé chez Stripe : ${err.message}`,
      );
    }

    await StripeAccount.deleteOne({ _id: account._id });

    await audit(req, {
      action: "bankinfo_delete",
      userId,
      metadata: {
        scope: "stripe_disconnect",
        stripeAccountId: account.stripeAccountId,
        deletedAtStripe,
        poolsClosed: closed.modifiedCount ?? 0,
      },
    });

    res.status(200).json({
      message: "Compte de paiement déconnecté.",
      poolsClosed: closed.modifiedCount ?? 0,
      deletedAtStripe,
    });
  } catch (error) {
    console.error("❌ Error disconnecting Stripe account:", error);
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
