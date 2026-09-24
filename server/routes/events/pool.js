const express = require("express");
const router = express.Router();
const stripe = require("../../config/stripe.config");
const Event = require("../../models/event.model");
const User = require("../../models/user.model");
const StripeAccount = require("../../models/stripeAccount.model");
const GiftPoolContribution = require("../../models/giftPoolContribution.model");
const { isAuthenticated } = require("../../middleware/jwt.middleware");
const { requireAdultForPool } = require("../../middleware/requireAdultForPool");
const { audit } = require("../../services/auditLog");

// Montant min/max d'une contribution (centimes) — garde-fous
const MIN_AMOUNT = 100; // 1 €
const MAX_AMOUNT = 1000000; // 10 000 €

/**
 * Seuil au-delà duquel le 3D Secure est IMPOSÉ (centimes).
 *
 * En dessous, Stripe décide seul — ce qui suffit dans l'immense majorité des
 * cas puisque la SCA européenne impose déjà l'authentification très souvent.
 * Au-dessus, on ne prend plus le risque : une authentification réussie fait
 * basculer sur l'émetteur la responsabilité d'une opposition pour fraude.
 *
 * Réglable sans redéploiement pour pouvoir le descendre si de la fraude
 * apparaît, ou le remonter si trop de paiements se perdent dans l'étape.
 */
const FORCE_3DS_ABOVE = parseInt(process.env.FORCE_3DS_ABOVE) || 15000; // 150 €

// Frais Stripe France, carte européenne standard : 1,5 % + 0,25 € PAR
// transaction. Le fixe s'applique à CHAQUE contribution, pas une fois sur le
// total. Mêmes constantes que le calcul affiché côté front.
const FEE_PERCENT = 0.015;
const FEE_FIXED = 25;

/**
 * Estimation des frais, au tarif d'une carte européenne STANDARD.
 *
 * ⚠️ Ne vaut que pour ce cas : une carte européenne professionnelle est à
 * 2,8 %, une britannique à 2,5 %, une carte hors Europe à 3,15 % plus 2 % de
 * conversion. Ce n'est donc qu'un repli, pour les contributions encaissées
 * avant qu'on ne stocke les frais réels.
 */
const estimatedFee = (amountCents) =>
  Math.round(amountCents * FEE_PERCENT) + FEE_FIXED;

/**
 * Ce qu'un remboursement coûte à l'organisateur, en centimes.
 *
 * ⚠️ Stripe ne restitue PAS les frais de la transaction d'origine. Le
 * contributeur, lui, récupère l'intégralité de ce qu'il a payé. L'écart est
 * donc entièrement à la charge de l'organisateur : c'est le chiffre qu'il faut
 * lui montrer AVANT qu'il déclenche l'opération, pas après.
 *
 * On utilise les frais RÉELS relevés à l'encaissement dès qu'ils existent —
 * l'estimation ci-dessus pouvait valoir la moitié de la perte réelle selon la
 * carte utilisée par le contributeur.
 */
const refundFeeLoss = (contribution) =>
  typeof contribution.feeCents === "number"
    ? contribution.feeCents
    : estimatedFee(contribution.amount);

/*
 * GET /api/events/mine/contributions
 * Historique des contributions de l'utilisateur connecté.
 * DOIT ÊTRE AVANT /:shortId/pool.
 *
 * ⚠️ Pourquoi cet écran existe.
 *
 * En charges directes, une contribution disparaît de la vue de son auteur dès
 * qu'il quitte la page : l'argent est parti chez l'organisateur, et rien dans
 * l'application ne garde trace de ce qu'il a versé. Le jour où l'événement est
 * annulé, il doit réclamer à quelqu'un une somme dont il n'a plus ni le
 * montant exact, ni la date, ni la référence. Le reçu par email comble ce trou
 * pour les invités sans compte ; pour un inscrit, l'application peut faire
 * mieux et le lui montrer en permanence.
 *
 * C'est aussi ce qui rend la doctrine tenable : on peut dire « adressez-vous à
 * l'organisateur » à quelqu'un qui a les éléments sous les yeux.
 */
router.get("/mine/contributions", isAuthenticated, async (req, res) => {
  try {
    const userId = req.payload._id;

    const contributions = await GiftPoolContribution.find({
      contributor: userId,
      // Les tentatives échouées ou abandonnées n'ont aucun intérêt ici : elles
      // ne prouvent rien et inquiètent pour rien.
      status: { $in: ["succeeded", "refunded"] },
    })
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();

    const events = await Event.find({
      _id: { $in: contributions.map((c) => c.event) },
    })
      .select("shortId title status organizer")
      .populate("organizer", "name surname")
      .lean();

    const byId = {};
    events.forEach((e) => (byId[String(e._id)] = e));

    res.status(200).json({
      contributions: contributions.map((c) => {
        const ev = byId[String(c.event)];
        return {
          id: c._id,
          amount: c.amount,
          currency: c.currency || "eur",
          status: c.status,
          message: c.message || null,
          anonymous: !!c.anonymous,
          createdAt: c.createdAt,
          refundedAt: c.refundedAt || null,
          // La référence de paiement : c'est elle qu'on cite à l'organisateur
          // ou au support pour identifier la contribution sans ambiguïté.
          reference: c.stripePaymentIntentId,
          event: ev
            ? {
                shortId: ev.shortId,
                title: ev.title,
                status: ev.status,
                organizer: ev.organizer
                  ? `${ev.organizer.name}${ev.organizer.surname ? " " + ev.organizer.surname : ""}`
                  : null,
              }
            : null,
        };
      }),
    });
  } catch (error) {
    console.error("❌ Error fetching my contributions:", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

/*
 * GET /api/events/mine/pools
 * Cagnottes actives des événements que l'utilisateur ORGANISE, avec le total
 * collecté — pour le bandeau "Mes cagnottes" de l'accueil.
 * DOIT ÊTRE AVANT /:shortId/pool.
 *
 * ⚠️ 23/09/26 : les événements où l'on est seulement invité ont été retirés.
 * Un invité voyait sur son accueil le montant collecté et le nombre de
 * contributions d'une cagnotte qu'il ne gère pas — un suivi qui regarde
 * l'organisateur. Côté invité, ce qu'il a versé reste dans Profil →
 * Mes contributions.
 */
router.get("/mine/pools", isAuthenticated, async (req, res) => {
  try {
    const userId = req.payload._id;

    const events = await Event.find({
      organizer: userId,
      "giftPool.active": true,
    }).populate("forPerson", "name surname");

    const eventIds = events.map((e) => e._id);
    const totals = await GiftPoolContribution.aggregate([
      { $match: { event: { $in: eventIds }, status: "succeeded" } },
      {
        $group: {
          _id: "$event",
          total: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
    ]);
    const totalsByEvent = {};
    totals.forEach((t) => {
      totalsByEvent[String(t._id)] = { total: t.total, count: t.count };
    });

    const pools = events.map((e) => {
      const totalInfo = totalsByEvent[String(e._id)] || { total: 0, count: 0 };
      return {
        eventShortId: e.shortId,
        eventTitle: e.title,
        forPerson: e.forPerson || null,
        isOrganizer: String(e.organizer) === String(userId),
        mode: e.giftPool.mode,
        goal: e.giftPool.goal,
        currency: e.giftPool.currency || "eur",
        deadline: e.giftPool.deadline,
        totalCollected: totalInfo.total,
        contributionsCount: totalInfo.count,
      };
    });

    res.status(200).json({ pools });
  } catch (error) {
    console.error("❌ Error fetching my pools:", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

/*
 * GET /api/events/:shortId/pool/refund-preview — chiffrer avant d'agir
 * (organizer only)
 *
 * Séparé de l'exécution à dessein : l'organisateur doit voir ce que
 * l'opération lui coûte AVANT de la déclencher. Rembourser 12 contributions
 * lui fait perdre 12 × (1,5 % + 0,25 €) qui ne lui seront jamais rendus, et
 * découvrir ce chiffre après coup serait une mauvaise surprise à nos frais.
 */
router.get(
  "/:shortId/pool/refund-preview",
  isAuthenticated,
  async (req, res) => {
    try {
      const event = await Event.findOne({ shortId: req.params.shortId });
      if (!event)
        return res.status(404).json({ message: "Événement introuvable" });
      if (event.organizer.toString() !== req.payload._id)
        return res.status(403).json({ message: "Non autorisé" });

      const rows = await GiftPoolContribution.find({
        event: event._id,
        status: "succeeded",
      }).select("amount feeCents");

      const total = rows.reduce((sum, r) => sum + r.amount, 0);
      const feeLoss = rows.reduce((sum, r) => sum + refundFeeLoss(r), 0);
      // Contributions dont les frais restent estimés : encaissées avant qu'on
      // ne relève le montant réel, ou webhook qui n'a pas pu le lire. Le front
      // s'en sert pour dire « environ » plutôt que d'annoncer un chiffre exact
      // qui ne l'est pas.
      const estimatedCount = rows.filter(
        (r) => typeof r.feeCents !== "number",
      ).length;

      res.status(200).json({
        count: rows.length,
        // Ce que les contributeurs récupèrent : l'intégralité.
        totalRefunded: total,
        // Ce que ça coûte à l'organisateur, en plus.
        feeLoss,
        estimatedCount,
        currency: event.giftPool?.currency || "eur",
      });
    } catch (error) {
      console.error("❌ Error previewing refunds:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  },
);

/*
 * POST /api/events/:shortId/pool/refund-all — rembourser tout le monde
 * (organizer only)
 *
 * ⚠️ Stripe n'a pas d'endpoint de remboursement en lot : c'est un appel par
 * contribution, et la boucle vit donc ici. Elle est volontairement tolérante
 * aux échecs — un remboursement refusé (carte expirée côté réseau, solde
 * insuffisant sur le compte connecté) ne doit pas empêcher les onze autres
 * d'aboutir. On renvoie un rapport, et l'organisateur relance : l'opération
 * est idempotente puisque seules les contributions encore "succeeded" sont
 * reprises.
 *
 * ⚠️ Le passage en "refunded" n'est PAS prononcé ici mais par le webhook
 * `charge.refunded`, comme l'encaissement l'est par `payment_intent.succeeded`.
 * Stripe reste la source de vérité de ce qui s'est réellement passé côté
 * argent.
 */
router.post("/:shortId/pool/refund-all", isAuthenticated, async (req, res) => {
  try {
    const event = await Event.findOne({ shortId: req.params.shortId });
    if (!event)
      return res.status(404).json({ message: "Événement introuvable" });
    if (event.organizer.toString() !== req.payload._id)
      return res.status(403).json({ message: "Non autorisé" });

    const account = await StripeAccount.findOne({ user: event.organizer });
    if (!account?.stripeAccountId)
      return res.status(400).json({
        code: "NO_STRIPE_ACCOUNT",
        message: "Aucun compte Stripe connecté pour cet événement.",
      });

    const rows = await GiftPoolContribution.find({
      event: event._id,
      status: "succeeded",
    });
    if (rows.length === 0)
      return res
        .status(400)
        .json({ code: "NOTHING_TO_REFUND", message: "Aucune contribution à rembourser" });

    // La collecte se ferme d'abord : rembourser pendant qu'une contribution
    // peut encore arriver produirait un reliquat invisible dans le rapport.
    if (event.giftPool?.active) {
      event.giftPool.active = false;
      event.giftPoolEnabled = false;
      await event.save();
      await audit(req, {
        action: "pool_freeze",
        userId: req.payload._id,
        metadata: { eventShortId: event.shortId, cause: "refund_all" },
      });
    }

    const report = { refunded: 0, failed: 0, amount: 0, feeLoss: 0, errors: [] };

    for (const row of rows) {
      const loss = refundFeeLoss(row);
      try {
        const refund = await stripe.refunds.create(
          {
            payment_intent: row.stripePaymentIntentId,
            // La trace remonte dans le dashboard Stripe de l'organisateur, qui
            // n'a aucune autre façon de relier ce mouvement à l'événement.
            metadata: {
              eventShortId: event.shortId,
              contributionId: row._id.toString(),
            },
          },
          { stripeAccount: account.stripeAccountId },
        );
        row.stripeRefundId = refund.id;
        row.refundFeeLoss = loss;
        // Statut laissé à "succeeded" : c'est `charge.refunded` qui le fera
        // basculer. Si le webhook n'arrive jamais, la contribution reste
        // reprise au prochain appel — mais Stripe refusera un second
        // remboursement du même PaymentIntent, donc aucun double débit.
        await row.save();
        report.refunded += 1;
        report.amount += row.amount;
        report.feeLoss += loss;
      } catch (err) {
        report.failed += 1;
        report.errors.push({
          contributionId: row._id.toString(),
          amount: row.amount,
          message: err?.message || "Erreur Stripe",
        });
        console.error(
          `❌ Remboursement échoué (${row.stripePaymentIntentId}):`,
          err?.message,
        );
      }
    }

    res.status(200).json(report);

    await audit(req, {
      action: "pool_refund",
      userId: req.payload._id,
      metadata: {
        eventShortId: event.shortId,
        requested: rows.length,
        refunded: report.refunded,
        failed: report.failed,
        amountCents: report.amount,
        feeLossCents: report.feeLoss,
      },
    });
  } catch (error) {
    console.error("❌ Error refunding pool:", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

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

    // Auth optionnelle : on cherche à savoir si le demandeur est l'organisateur.
    // (endpoint public, mais l'organisateur voit plus de détails — façon Leetchi)
    let requesterId = null;
    const jwt = require("jsonwebtoken");
    const token =
      req.headers.authorization?.split(" ")[1] || req.cookies?.authToken;
    if (token) {
      try {
        requesterId = jwt.verify(token, process.env.TOKEN_SECRET)._id;
      } catch (_) {}
    }
    const isOrganizer =
      requesterId && event.organizer.toString() === String(requesterId);

    const pool = event.giftPool || {};
    if (!pool.active) {
      return res.status(200).json({ active: false, eventTitle: event.title });
    }

    // Total réellement encaissé (statut succeeded uniquement)
    const contributions = await GiftPoolContribution.find({
      event: event._id,
      status: "succeeded",
    })
      .populate("contributor", "name surname avatar")
      .sort({ createdAt: -1 });

    const totalCollected = contributions.reduce((sum, c) => sum + c.amount, 0);

    // Règles d'affichage (modèle Leetchi) :
    //  - pseudonyme (guestName) renseigné  → affiché à TOUT LE MONDE (org compris)
    //  - sinon, identité réelle du contributeur (ou "Invité")
    //  - anonymous = true → masqué pour les AUTRES participants ("Anonyme"),
    //    mais l'organisateur voit toujours l'identité de base.
    const display = (c) => {
      const pseudonym = c.guestName ? c.guestName.trim() : "";
      let base;
      if (pseudonym) base = { name: pseudonym, surname: "", avatar: null };
      else if (c.contributor)
        base = {
          name: c.contributor.name,
          surname: c.contributor.surname,
          avatar: c.contributor.avatar,
        };
      else base = { name: "Invité", surname: "", avatar: null };

      if (c.anonymous && !isOrganizer) return null; // masqué pour les autres
      return base;
    };

    res.status(200).json({
      active: true,
      eventTitle: event.title,
      eventShortId: event.shortId,
      isOrganizer: !!isOrganizer,
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
        anonymous: !!c.anonymous,
        contributor: display(c),
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
// Toute requête qui laisse la cagnotte ouverte (active: true) exige 18 ans ;
// la fermer reste toujours permis.
router.put(
  "/:shortId/pool",
  isAuthenticated,
  requireAdultForPool((req) => !!req.body?.active),
  async (req, res) => {
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
    const wasActive = !!current.active;
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

    // On ne consigne que les BASCULES d'activation, pas chaque réglage de
    // montant : c'est l'ouverture et la fermeture d'une collecte d'argent qui
    // engagent l'organisateur, pas le passage d'un objectif de 200 à 250 €.
    if (wasActive !== event.giftPool.active) {
      await audit(req, {
        action: event.giftPool.active ? "pool_enable" : "pool_disable",
        userId: req.payload._id,
        metadata: {
          eventShortId: event.shortId,
          mode: event.giftPool.mode,
          goal: event.giftPool.goal,
          currency: event.giftPool.currency,
        },
      });
    }
  } catch (error) {
    console.error("❌ Error updating gift pool:", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
  },
);

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

    // La cagnotte est coupée à l'annulation, donc `pool.active` suffirait —
    // mais un message explicite vaut mieux qu'un « cagnotte inactive » pour
    // quelqu'un qui ne sait pas encore que l'événement est annulé.
    if (event.status === "cancelled") {
      return res.status(409).json({
        code: "EVENT_CANCELLED",
        message:
          "Cet événement est annulé : la cagnotte n'accepte plus de contribution.",
      });
    }

    const pool = event.giftPool || {};
    if (!pool.active) {
      return res
        .status(400)
        .json({ message: "La cagnotte n'est pas active pour cet événement." });
    }

    const { amount, message, anonymous, guestName, guestEmail } = req.body;
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

    // ── Acceptation des conditions, pour les contributeurs SANS COMPTE ────
    // Un contributeur inscrit les a acceptées à l'inscription (case obligatoire
    // sur les deux applications, horodatée sur son compte) : on ne la redemande
    // pas. Un visiteur du lien public n'avait, lui, jamais rien accepté.
    if (!contributorId && req.body.acceptTerms !== true) {
      return res.status(400).json({
        code: "TERMS_REQUIRED",
        message:
          "Vous devez accepter les conditions d'utilisation pour contribuer.",
      });
    }

    // ── Adresse du contributeur ───────────────────────────────────────────
    // Elle sert deux fois : à Stripe pour son reçu automatique, et à nous pour
    // notre propre accusé de réception (envoyé par le webhook).
    //
    // ⚠️ Obligatoire pour un invité. On a longtemps cru que le PaymentElement
    // s'en chargeait — il ne le fait pas : il ne collecte l'email que dans
    // certaines configurations, et ça n'alimente de toute façon pas
    // `receipt_email`. Un invité repartait donc sans la moindre trace de son
    // paiement, alors que c'est précisément lui qui n'a pas de compte où la
    // retrouver. Sans preuve, il n'a aucun recours le jour où ça se passe mal.
    let receiptEmail = null;
    if (contributorId) {
      const u = await User.findById(contributorId).select("email");
      if (u?.email) receiptEmail = u.email;
    } else {
      const raw = String(guestEmail ?? "").trim().toLowerCase();
      if (!raw || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(raw)) {
        return res.status(400).json({
          code: "EMAIL_REQUIRED",
          message:
            "Une adresse email valide est nécessaire pour vous envoyer le reçu de votre contribution.",
        });
      }
      if (raw.length > 254) {
        return res
          .status(400)
          .json({ code: "EMAIL_REQUIRED", message: "Adresse email trop longue." });
      }
      receiptEmail = raw;
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
        // ── 3D Secure ─────────────────────────────────────────────────────
        //
        // Le 3DS s'applique déjà automatiquement dès que l'émetteur l'exige
        // (SCA européenne) : ce n'est pas ce bloc qui l'active. Il le FORCE
        // au-delà d'un seuil, là où Stripe l'aurait peut-être jugé inutile.
        //
        // Pourquoi : une authentification 3DS réussie fait basculer sur la
        // banque émettrice la responsabilité d'une opposition pour FRAUDE.
        // Sans elle, une contribution payée avec une carte volée revient en
        // opposition, le compte de l'organisateur part en négatif, et la
        // perte remonte la cascade. C'est la seule protection réellement
        // efficace contre ce scénario — une rétention des fonds ne sert à
        // rien, l'opposition arrivant souvent 60 jours plus tard.
        //
        // Le seuil est un compromis : le 3DS ajoute une étape et fait perdre
        // quelques paiements. On l'impose donc seulement là où le montant
        // justifie la friction. À 20 € entre amis, on laisse Stripe décider.
        //
        // ⚠️ Le basculement ne couvre QUE les litiges pour fraude. Un « je
        // n'ai jamais eu mon cadeau » reste un désaccord entre l'organisateur
        // et son invité, 3DS ou pas.
        ...(amountInt >= FORCE_3DS_ABOVE
          ? {
              payment_method_options: {
                card: { request_three_d_secure: "any" },
              },
            }
          : {}),
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

    // Trace la contribution en pending ; le webhook la passera à succeeded.
    // guestName sert de "nom affiché / pseudonyme" — valable aussi pour un
    // utilisateur connecté qui veut masquer son vrai nom (y compris à l'organisateur).
    await GiftPoolContribution.create({
      event: event._id,
      contributor: contributorId,
      guestTermsAcceptedAt: contributorId ? null : new Date(),
      guestEmail: contributorId ? null : receiptEmail,
      guestName: guestName ? String(guestName).trim().slice(0, 60) : undefined,
      amount: amountInt,
      currency: pool.currency || "eur",
      message: message ? String(message).trim().slice(0, 500) : undefined,
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
