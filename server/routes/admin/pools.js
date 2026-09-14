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
const { audit } = require("../../services/auditLog");
const PoolAlertReview = require("../../models/poolAlertReview.model");
const Log = require("../../models/log.model");
const SupportMessage = require("../../models/supportMessage.model");

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

    // ⚠️ Litiges en cours sur chaque cagnotte.
    //
    // Sans ce croisement, la liste des cagnottes et celle des tickets ne se
    // rencontrent jamais : on peut passer en revue toutes les cagnottes sans
    // voir laquelle a un contributeur mécontent qui attend une réponse. C'est
    // pourtant la seule qu'il faut regarder en premier.
    const ticketAgg = await SupportMessage.aggregate([
      { $match: { relatedEvent: { $in: eventIds } } },
      {
        $group: {
          _id: "$relatedEvent",
          total: { $sum: 1 },
          open: { $sum: { $cond: [{ $ne: ["$status", "closed"] }, 1, 0] } },
        },
      },
    ]);
    const ticketsByEvent = {};
    ticketAgg.forEach((t) => (ticketsByEvent[String(t._id)] = t));

    res.json({
      pools: events.map((e) => ({
        ticketsCount: ticketsByEvent[String(e._id)]?.total || 0,
        openTicketsCount: ticketsByEvent[String(e._id)]?.open || 0,
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

    // ── Croisement avec le registre de traitement ─────────────────────────
    //
    // Une alerte déjà tranchée n'est pas retirée de la liste : elle est
    // marquée. La masquer ferait perdre de vue des cagnottes qui restent à
    // risque, et empêcherait surtout de constater qu'une décision a été prise
    // — ce qu'on cherche précisément à pouvoir montrer.
    //
    // En revanche une décision devient caduque dès que les chiffres bougent :
    // « écartée, 180 € entre amis » ne vaut plus rien quand la cagnotte en est
    // à 900 €. On compare donc l'empreinte enregistrée à la situation
    // actuelle, et l'alerte se rouvre d'elle-même si elle a changé.
    const reviews = await PoolAlertReview.find({
      event: { $in: alerts.map((a) => a.event._id) },
    }).populate("reviewedBy", "name surname");

    const byKey = {};
    reviews.forEach((r) => {
      byKey[`${r.event}|${r.alertType}`] = r;
    });

    const decorated = alerts.map((a) => {
      const r = byKey[`${a.event._id}|${a.type}`];
      if (!r) return { ...a, review: null, needsReview: true };

      const stale =
        r.snapshot?.collected !== a.totals.collected ||
        r.snapshot?.contributions !== a.totals.contributions ||
        r.snapshot?.refunded !== a.totals.refunded;

      return {
        ...a,
        review: {
          status: r.status,
          reason: r.reason,
          actionTaken: r.actionTaken,
          reviewedAt: r.updatedAt,
          reviewedBy: r.reviewedBy
            ? `${r.reviewedBy.name}${r.reviewedBy.surname ? " " + r.reviewedBy.surname : ""}`
            : null,
          stale,
        },
        needsReview: stale,
      };
    });

    // Les alertes à traiter remontent en tête : c'est la seule liste qui
    // compte au quotidien.
    decorated.sort((a, b) => Number(b.needsReview) - Number(a.needsReview));

    res.json({
      alerts: decorated,
      thresholds: THRESHOLDS,
      pendingCount: decorated.filter((a) => a.needsReview).length,
    });
  } catch (error) {
    console.error("❌ Admin pool alerts error:", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

/*
 * PATCH /api/admin/pools/:eventId/freeze
 * Body: { frozen: boolean, reason: string }
 *
 * Gèle ou rouvre une cagnotte depuis l'admin.
 *
 * ⚠️ Geler ≠ rembourser. Le gel ferme le robinet — plus aucune contribution ne
 * peut entrer — mais ne touche pas à l'argent déjà collecté, qui reste sur le
 * compte Stripe de l'organisateur. C'est l'intervention la plus utile face à
 * une cagnotte suspecte : elle limite le nombre de victimes sans nous faire
 * décider à la place de qui que ce soit, et elle est réversible.
 *
 * Jusqu'ici le gel n'existait qu'en conséquence automatique d'une annulation
 * ou d'un transfert d'organisation. Face à une alerte de fraude, il n'y avait
 * donc aucun moyen d'agir : on pouvait constater et rembourser, mais pas
 * simplement arrêter l'hémorragie.
 *
 * Motif obligatoire : c'est une décision qui prive l'organisateur d'une
 * fonctionnalité, elle doit pouvoir être justifiée.
 */
router.patch("/:eventId/freeze", async (req, res) => {
  try {
    const frozen = req.body.frozen === true;
    const reason = String(req.body.reason || "").trim();
    if (reason.length < 10) {
      return res.status(400).json({
        code: "REASON_REQUIRED",
        message:
          "Un motif d'au moins 10 caractères est obligatoire : geler une " +
          "cagnotte prive l'organisateur d'une fonctionnalité.",
      });
    }

    const event = await Event.findById(req.params.eventId).select(
      "shortId title organizer giftPool",
    );
    if (!event) {
      return res.status(404).json({ message: "Événement introuvable" });
    }
    if (!event.giftPool) {
      return res.status(400).json({ message: "Cet événement n'a pas de cagnotte." });
    }

    // `active: false` est exactement ce que lit la route de contribution :
    // aucun nouveau paiement ne peut plus être créé.
    event.giftPool.active = !frozen;
    await event.save();

    await audit(req, {
      action: frozen ? "pool_freeze" : "pool_enable",
      userId: req.payload._id,
      metadata: {
        scope: "admin",
        eventId: String(event._id),
        eventShortId: event.shortId,
        organizerId: String(event.organizer),
        reason,
      },
    });

    req.app
      .get("io")
      ?.to(`event:${event.shortId}`)
      .emit("event:pool_update", { shortId: event.shortId });

    res.json({
      message: frozen ? "Cagnotte gelée" : "Cagnotte rouverte",
      active: event.giftPool.active,
    });
  } catch (error) {
    console.error("❌ Admin pool freeze error:", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

/*
 * GET /api/admin/pools/:eventId/evidence
 * Dossier de preuve d'une cagnotte, en JSON téléchargeable.
 *
 * ⚠️ À quoi ça sert concrètement : le jour où un contributeur, un organisateur,
 * une banque ou une autorité demande « prouvez ce qui s'est passé », il faut
 * pouvoir produire en une fois l'intégralité de ce que nous savons. Reconstituer
 * ça à la main depuis trois écrans, sous pression et parfois des mois après,
 * c'est la garantie d'oublier une pièce.
 *
 * Le dossier réunit les trois sources qui font foi : les contributions (avec
 * leurs références Stripe, les seuls identifiants opposables), le journal
 * d'audit permanent (qui a décidé quoi, quand, pour quel motif) et les tickets
 * de support rattachés à cette cagnotte.
 *
 * ⚠️ Contient des données personnelles : à ne transmettre qu'aux personnes
 * concernées ou sur demande légitime, jamais par simple curiosité.
 */
router.get("/:eventId/evidence", async (req, res) => {
  try {
    const event = await Event.findById(req.params.eventId)
      .select("shortId title status organizer giftPool createdAt")
      .populate("organizer", "name surname email");
    if (!event) {
      return res.status(404).json({ message: "Événement introuvable" });
    }

    const [contributions, logs, tickets, account] = await Promise.all([
      GiftPoolContribution.find({ event: event._id })
        .populate("contributor", "name surname email")
        .sort({ createdAt: 1 })
        .lean(),
      Log.find({
        "metadata.eventShortId": event.shortId,
      })
        .sort({ createdAt: 1 })
        .lean(),
      SupportMessage.find({ relatedEvent: event._id })
        .populate("userId", "name surname email")
        .sort({ createdAt: 1 })
        .lean(),
      StripeAccount.findOne({ user: event.organizer?._id }).lean(),
    ]);

    const dossier = {
      generatedAt: new Date().toISOString(),
      generatedBy: String(req.payload._id),
      avertissement:
        "Document interne contenant des données personnelles. Ne transmettre " +
        "qu'aux personnes concernées ou sur demande légitime.",
      evenement: {
        shortId: event.shortId,
        titre: event.title,
        statut: event.status,
        creeLe: event.createdAt,
        cagnotteActive: !!event.giftPool?.active,
        organisateur: event.organizer
          ? {
              id: String(event.organizer._id),
              nom: `${event.organizer.name} ${event.organizer.surname || ""}`.trim(),
              email: event.organizer.email,
            }
          : null,
        compteStripe: account
          ? {
              id: account.stripeAccountId,
              encaissementsActifs: account.chargesEnabled,
              virementsActifs: account.payoutsEnabled,
            }
          : null,
      },
      contributions: contributions.map((c) => ({
        id: String(c._id),
        montantCentimes: c.amount,
        devise: c.currency,
        statut: c.status,
        date: c.createdAt,
        // La référence Stripe est le seul identifiant opposable : c'est elle
        // qu'une banque ou un juge pourra recouper.
        referencePaiement: c.stripePaymentIntentId,
        referenceRemboursement: c.stripeRefundId,
        rembourseLe: c.refundedAt,
        fraisReelsCentimes: c.feeCents,
        contributeur: c.contributor
          ? {
              id: String(c.contributor._id),
              nom: `${c.contributor.name} ${c.contributor.surname || ""}`.trim(),
              email: c.contributor.email,
            }
          : { invite: true, email: c.guestEmail || null, nom: c.guestName || null },
        anonyme: !!c.anonymous,
        conditionsAccepteesLe: c.guestTermsAcceptedAt,
        recuEnvoyeLe: c.receiptSentAt,
      })),
      journal: logs.map((l) => ({
        date: l.createdAt,
        action: l.action,
        auteur: l.userId ? String(l.userId) : null,
        ip: l.ipAddress,
        details: l.metadata,
      })),
      tickets: tickets.map((t) => ({
        id: String(t._id),
        objet: t.subject,
        statut: t.status,
        ouvertLe: t.createdAt,
        auteur: t.userId
          ? `${t.userId.name} ${t.userId.surname || ""}`.trim()
          : t.name,
        email: t.email,
        messages: t.messages?.map((m) => ({
          de: m.sender,
          date: m.createdAt,
          texte: m.body,
        })),
      })),
    };

    const filename = `preuves-${event.shortId}-${new Date().toISOString().slice(0, 10)}.json`;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(JSON.stringify(dossier, null, 2));
  } catch (error) {
    console.error("❌ Admin evidence error:", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

/*
 * POST /api/admin/pools/alerts/review
 * Tranche une alerte : l'écarter, ou consigner l'action prise.
 * Body: { eventId, alertType, status: "dismissed"|"actioned", reason, actionTaken? }
 *
 * ⚠️ `reason` est obligatoire côté SERVEUR, pas seulement dans l'interface.
 * Le registre ne vaut que par ce qu'il contient : une décision sans motif ne
 * prouve rien et donne seulement l'illusion d'un processus.
 */
router.post("/alerts/review", async (req, res) => {
  try {
    const {
      computePoolAlerts,
    } = require("../../services/poolFraudService");
    const { eventId, alertType, status, reason, actionTaken } = req.body;

    if (!eventId || !alertType) {
      return res
        .status(400)
        .json({ message: "eventId et alertType sont requis." });
    }
    if (!["dismissed", "actioned"].includes(status)) {
      return res.status(400).json({ message: "Statut invalide." });
    }
    const cleanReason = String(reason || "").trim();
    if (cleanReason.length < 10) {
      return res.status(400).json({
        code: "REASON_REQUIRED",
        message:
          "Un motif d'au moins 10 caractères est obligatoire : c'est lui qui " +
          "justifie la décision si elle est contestée plus tard.",
      });
    }

    // On fige la situation telle qu'elle est au moment de la décision.
    const alerts = await computePoolAlerts();
    const current = alerts.find(
      (a) => String(a.event._id) === String(eventId) && a.type === alertType,
    );

    const review = await PoolAlertReview.findOneAndUpdate(
      { event: eventId, alertType },
      {
        status,
        reason: cleanReason,
        actionTaken: status === "actioned" ? actionTaken || "other" : null,
        reviewedBy: req.payload._id,
        ...(current
          ? {
              snapshot: {
                collected: current.totals.collected,
                contributions: current.totals.contributions,
                refunded: current.totals.refunded,
              },
            }
          : {}),
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );

    const eventDoc = await Event.findById(eventId).select("shortId");

    // Trace permanente : c'est la pièce qui démontrera que l'alerte a été
    // examinée. Elle doit survivre à la purge annuelle du journal.
    await audit(req, {
      action: "pool_alert_reviewed",
      userId: req.payload._id,
      metadata: {
        eventId: String(eventId),
        eventShortId: eventDoc?.shortId || null,
        alertType,
        status,
        reason: cleanReason,
        actionTaken: review.actionTaken,
        snapshot: review.snapshot,
      },
    });

    res.json({ message: "Décision enregistrée", review });
  } catch (error) {
    console.error("❌ Admin alert review error:", error);
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

    // État du compte Connect de l'organisateur.
    //
    // ⚠️ À afficher AVANT tout bouton de remboursement. En charges directes,
    // rembourser prélève sur le solde de l'organisateur ; s'il l'a déjà vidé,
    // le compte part en négatif et la perte finit chez nous. Le solde n'est
    // donc pas une information de confort : c'est ce qui distingue un
    // remboursement légitime d'une avance qu'on s'apprête à faire sans le
    // savoir.
    let connectedAccount = null;
    try {
      const acc = await StripeAccount.findOne({ user: event.organizer?._id });
      if (acc) {
        const [balance, stripeAcct] = await Promise.all([
          // ⚠️ Le compte connecté est une OPTION (2e argument), pas un
          // paramètre : passé en 1er, Stripe répond « unknown parameter ».
          stripe.balance.retrieve({}, { stripeAccount: acc.stripeAccountId }),
          stripe.accounts.retrieve(acc.stripeAccountId),
        ]);
        const sum = (arr) =>
          (arr || [])
            .filter((b) => b.currency === "eur")
            .reduce((t, b) => t + b.amount, 0);

        connectedAccount = {
          stripeAccountId: acc.stripeAccountId,
          availableCents: sum(balance.available),
          pendingCents: sum(balance.pending),
          chargesEnabled: stripeAcct.charges_enabled,
          payoutsEnabled: stripeAcct.payouts_enabled,
          detailsSubmitted: stripeAcct.details_submitted,
          // "application" = BirthReminder porte la perte en cas de solde
          // négatif irrécouvrable ; "stripe" = Stripe la porte.
          lossesPayer: stripeAcct.controller?.losses?.payments ?? null,
        };
      }
    } catch (err) {
      console.error("[admin.pools] compte Connect illisible:", err.message);
    }

    res.json({ event, contributions, connectedAccount });
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

    // ── Motif obligatoire ─────────────────────────────────────────────────
    //
    // Un remboursement administrateur est une EXCEPTION : la règle est que
    // l'organisateur rembourse lui-même. Chaque fois qu'on s'y substitue, il
    // faut pouvoir dire pourquoi — sinon la trace ne vaut rien le jour où on
    // demande des comptes, et l'exception se banalise en service après-vente.
    //
    // Même exigence que sur les décisions d'alerte : c'est le texte qui
    // justifie l'acte, pas le fait qu'un bouton ait été cliqué.
    const refundReason = String(req.body.reason || "").trim();
    if (refundReason.length < 10) {
      return res.status(400).json({
        code: "REASON_REQUIRED",
        message:
          "Un motif d'au moins 10 caractères est obligatoire : un remboursement " +
          "administrateur est une exception, elle doit être justifiée par écrit.",
      });
    }

    const account = await StripeAccount.findOne({
      user: contribution.event.organizer,
    });
    if (!account)
      return res
        .status(400)
        .json({ message: "Compte Stripe de l'organisateur introuvable." });

    // ── Garde-fou : y a-t-il encore de l'argent à rembourser ? ────────────
    //
    // ⚠️ C'est ici que la plateforme peut se faire très mal.
    //
    // En charges directes, Stripe débite le remboursement du solde du compte
    // de l'ORGANISATEUR. S'il a déjà viré sa collecte sur sa banque, ce solde
    // est vide : le compte part en négatif. Stripe tente alors de se
    // rembourser sur son compte bancaire externe, et si ça échoue — compte
    // clos, compte à sec — la perte remonte selon
    // `controller.losses.payments`. Sur nos comptes Express, cette valeur vaut
    // `application` : c'est BirthReminder qui paie, après une réserve retenue
    // puis une ponction au bout de 180 jours de négatif.
    //
    // La nuance décisive : un chargeback nous est imposé, alors qu'un
    // remboursement déclenché ici est un acte VOLONTAIRE. Rembourser sans
    // vérifier le solde, c'est créer nous-mêmes le trou que nous finirons par
    // combler. D'où ce contrôle, et d'où le fait qu'il soit bloquant.
    //
    // `force` reste possible pour les cas où l'on assume sciemment l'avance
    // (fraude avérée, préservation de la réputation), mais il faut alors que
    // ce soit une décision prise en connaissance du montant.
    let balanceInfo = null;
    try {
      // ⚠️ Le compte connecté est une OPTION (2e argument), pas un paramètre.
      // Passé en 1er, Stripe lève « unknown parameter » — l'exception tombait
      // dans le catch plus bas, le solde restait inconnu, et le remboursement
      // passait SANS contrôle. Le garde-fou ne servait alors à rien.
      const balance = await stripe.balance.retrieve(
        {},
        { stripeAccount: account.stripeAccountId },
      );
      const currency = (contribution.currency || "eur").toLowerCase();
      const availableCents = (balance.available || [])
        .filter((b) => b.currency === currency)
        .reduce((sum, b) => sum + b.amount, 0);
      const pendingCents = (balance.pending || [])
        .filter((b) => b.currency === currency)
        .reduce((sum, b) => sum + b.amount, 0);

      balanceInfo = { availableCents, pendingCents, currency };

      if (availableCents < contribution.amount && req.body.force !== true) {
        return res.status(409).json({
          code: "INSUFFICIENT_CONNECTED_BALANCE",
          message:
            `Solde insuffisant sur le compte de l'organisateur : ` +
            `${(availableCents / 100).toFixed(2)} € disponibles pour un remboursement ` +
            `de ${(contribution.amount / 100).toFixed(2)} €. ` +
            `Le compte passerait en négatif et la perte finirait à la charge de ` +
            `BirthReminder. Relancez l'organisateur pour qu'il réapprovisionne, ` +
            `ou confirmez en connaissance de cause.`,
          balance: balanceInfo,
          amount: contribution.amount,
        });
      }
    } catch (err) {
      // Solde illisible : on ne bloque pas une opération légitime pour autant,
      // mais on le consigne — c'est exactement le contexte qu'on voudra
      // retrouver si ce remboursement finit par nous coûter.
      console.error(
        `[admin.refund] solde du compte ${account.stripeAccountId} illisible :`,
        err.message,
      );
    }

    // Remboursement sur le compte Connect (la charge était directe)
    const refund = await stripe.refunds.create(
      { payment_intent: contribution.stripePaymentIntentId },
      { stripeAccount: account.stripeAccountId },
    );

    contribution.status = "refunded";
    await contribution.save();

    console.log(
      `↩️ Admin refund: contribution ${contribution._id} (event ${contribution.event.shortId}) — refund ${refund.id} par admin ${req.payload._id}` +
        (req.body.force === true ? " [FORCÉ malgré le solde]" : ""),
    );

    // Trace permanente : qui a remboursé, combien, et dans quel état de solde.
    // Si l'opération finit par nous être débitée, c'est cette ligne qui dira
    // si la décision avait été prise en connaissance du risque.
    await audit(req, {
      action: "pool_refund",
      userId: req.payload._id,
      metadata: {
        scope: "admin",
        contributionId: String(contribution._id),
        eventShortId: contribution.event.shortId,
        amount: contribution.amount,
        refundId: refund.id,
        forced: req.body.force === true,
        connectedBalance: balanceInfo,
        reason: refundReason.slice(0, 500),
      },
    });

    res.json({ message: "Contribution remboursée", refundId: refund.id, contribution });
  } catch (error) {
    console.error("❌ Admin refund error:", error);
    const stripeMsg = error?.raw?.message || error?.message;
    res.status(500).json({ message: `Erreur lors du remboursement : ${stripeMsg}` });
  }
});

module.exports = router;
