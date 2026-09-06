const express = require("express");
const router = express.Router();
const Event = require("../../models/event.model");
const EventInvitation = require("../../models/eventInvitation.model");
const User = require("../../models/user.model");
const GiftPoolContribution = require("../../models/giftPoolContribution.model");
const { isAuthenticated } = require("../../middleware/jwt.middleware");
const { notify } = require("../../utils/notify");
const { sendPushToUser } = require("../../services/pushService");
const { audit } = require("../../services/auditLog");

/**
 * Transfert de l'organisation d'un événement.
 *
 * ⚠️ En deux temps, et c'est le point central de ce fichier. Organiser n'est
 * pas un titre honorifique : c'est gérer des invitations, trancher des votes,
 * répondre aux participants, et parfois porter une cagnotte sur son propre
 * compte Stripe. On ne peut donc pas l'imposer. L'organisateur PROPOSE, la
 * personne visée ACCEPTE ou REFUSE, et tant qu'elle n'a pas répondu, rien ne
 * change : l'ancien organisateur garde toutes ses prérogatives.
 *
 * ⚠️ La cagnotte ne suit JAMAIS le transfert. En charges directes, l'argent
 * déjà versé se trouve sur le compte Stripe de l'ancien organisateur, et il
 * n'existe pas de moyen propre de le déplacer vers un autre compte connecté —
 * il faudrait passer au modèle "separate charges & transfers", qui remettrait
 * BirthReminder dans le flux d'argent. L'ancien organisateur reste donc seul
 * responsable des sommes reçues : il rembourse, ou il reverse de la main à la
 * main. Le nouvel organisateur peut ouvrir SA propre cagnotte ensuite.
 */

/** Résumé de cagnotte utilisé pour avertir avant et après le transfert. */
async function poolSummary(eventId) {
  const rows = await GiftPoolContribution.find({
    event: eventId,
    status: "succeeded",
  }).select("amount");
  return {
    count: rows.length,
    total: rows.reduce((sum, r) => sum + r.amount, 0),
  };
}

/*
 * POST /api/events/:shortId/transfer-lead — proposer l'organisation
 * Body: { userId }
 */
router.post("/:shortId/transfer-lead", isAuthenticated, async (req, res) => {
  try {
    const event = await Event.findOne({ shortId: req.params.shortId });
    if (!event)
      return res.status(404).json({ message: "Événement introuvable" });
    if (event.organizer.toString() !== req.payload._id)
      return res.status(403).json({ message: "Non autorisé" });

    const { userId } = req.body || {};
    if (!userId)
      return res.status(400).json({ message: "Destinataire manquant" });
    if (userId === req.payload._id)
      return res
        .status(400)
        .json({ message: "Tu organises déjà cet événement" });

    // Cible obligatoirement un participant AYANT ACCEPTÉ : proposer
    // l'organisation à quelqu'un qui n'a pas confirmé sa venue, ou qui a
    // décliné, n'a pas de sens — et à un invité externe sans compte,
    // techniquement impossible (il n'a pas de session pour accepter).
    const invitation = await EventInvitation.findOne({
      event: event._id,
      user: userId,
      status: "accepted",
    });
    if (!invitation)
      return res.status(400).json({
        code: "NOT_ACCEPTED_PARTICIPANT",
        message:
          "Tu ne peux transférer l'organisation qu'à un participant ayant confirmé sa présence.",
      });

    if (event.pendingTransfer?.toUser)
      return res.status(409).json({
        code: "TRANSFER_PENDING",
        message: "Une proposition de transfert est déjà en attente.",
      });

    event.pendingTransfer = {
      toUser: userId,
      requestedBy: req.payload._id,
      requestedAt: new Date(),
    };
    await event.save();

    const pool = await poolSummary(event._id);
    res.status(200).json({ pending: true, pool });

    const me = await User.findById(req.payload._id).select("name surname");
    const fromName = `${me?.name || ""} ${me?.surname || ""}`.trim() || "L'organisateur";

    await notify(req.app, {
      userId,
      type: "event_transfer_offer",
      data: {
        eventTitle: event.title,
        eventShortId: event.shortId,
        fromName,
        poolCount: pool.count,
        poolTotal: pool.total,
      },
      link: `/event/${event.shortId}`,
    });
    await sendPushToUser(userId, {
      title: `🤝 ${fromName} te propose d'organiser`,
      body: `« ${event.title} » — à toi de décider`,
      url: `/event/${event.shortId}`,
      tag: `event-transfer-${event.shortId}`,
      type: "events",
    });
  } catch (error) {
    console.error("❌ Error offering lead transfer:", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

/*
 * DELETE /api/events/:shortId/transfer-lead — retirer la proposition
 * Accessible à l'organisateur (il se ravise) comme au destinataire (refus).
 */
router.delete("/:shortId/transfer-lead", isAuthenticated, async (req, res) => {
  try {
    const event = await Event.findOne({ shortId: req.params.shortId });
    if (!event)
      return res.status(404).json({ message: "Événement introuvable" });

    const target = event.pendingTransfer?.toUser?.toString();
    if (!target)
      return res.status(400).json({ message: "Aucune proposition en attente" });

    const isOrganizer = event.organizer.toString() === req.payload._id;
    const isTarget = target === req.payload._id;
    if (!isOrganizer && !isTarget)
      return res.status(403).json({ message: "Non autorisé" });

    event.pendingTransfer = {
      toUser: null,
      requestedBy: null,
      requestedAt: null,
    };
    await event.save();

    res.status(200).json({ pending: false });

    // Un refus se signale ; un retrait par l'organisateur lui-même, non — il
    // sait ce qu'il vient de faire, et prévenir le destinataire d'une
    // proposition retirée avant qu'il l'ait vue n'apporte rien.
    if (isTarget) {
      const me = await User.findById(req.payload._id).select("name surname");
      const name = `${me?.name || ""} ${me?.surname || ""}`.trim() || "Le participant";
      await notify(req.app, {
        userId: event.organizer,
        type: "event_transfer_declined",
        data: {
          eventTitle: event.title,
          eventShortId: event.shortId,
          fromName: name,
        },
        link: `/event/${event.shortId}`,
      });
      await sendPushToUser(event.organizer, {
        title: `🤝 Transfert refusé — ${event.title}`,
        body: `${name} préfère ne pas reprendre l'organisation`,
        url: `/event/${event.shortId}`,
        tag: `event-transfer-declined-${event.shortId}`,
        type: "events",
      });
    }
  } catch (error) {
    console.error("❌ Error cancelling lead transfer:", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

/*
 * POST /api/events/:shortId/transfer-lead/accept — accepter l'organisation
 */
router.post(
  "/:shortId/transfer-lead/accept",
  isAuthenticated,
  async (req, res) => {
    try {
      const event = await Event.findOne({ shortId: req.params.shortId });
      if (!event)
        return res.status(404).json({ message: "Événement introuvable" });

      const target = event.pendingTransfer?.toUser?.toString();
      if (!target || target !== req.payload._id)
        return res
          .status(403)
          .json({ message: "Cette proposition ne t'est pas adressée" });

      const previousOrganizer = event.organizer.toString();
      const pool = await poolSummary(event._id);

      event.organizer = req.payload._id;
      event.pendingTransfer = {
        toUser: null,
        requestedBy: null,
        requestedAt: null,
      };

      // ⚠️ La cagnotte est coupée, jamais transférée : les fonds sont sur le
      // compte Stripe de l'ancien organisateur (voir l'en-tête du fichier).
      // Laisser la collecte ouverte ferait arriver de l'argent sur le compte
      // de quelqu'un qui n'organise plus.
      const poolWasActive = !!event.giftPool?.active;
      if (poolWasActive) {
        event.giftPool.active = false;
        event.giftPoolEnabled = false;
      }

      // Le RIB de virement direct appartenait à l'ancien organisateur : ses
      // options s'éteignent avec lui. Le RIB chiffré lui-même est supprimé.
      if (event.directTransfer) {
        event.directTransfer.ibanEnabled = false;
        event.directTransfer.paypalEnabled = false;
        event.directTransfer.paypalLink = null;
      }

      await event.save();

      const OrganizerBankInfo = require("../../models/organizerBankInfo.model");
      await OrganizerBankInfo.deleteOne({ event: event._id });

      // L'ancien organisateur reste participant : il ne disparaît pas de son
      // propre événement, et son invitation existe peut-être déjà.
      await EventInvitation.findOneAndUpdate(
        { event: event._id, user: previousOrganizer },
        { $setOnInsert: { event: event._id, user: previousOrganizer }, $set: { status: "accepted" } },
        { upsert: true },
      );

      res.status(200).json({
        organizer: event.organizer,
        poolFrozen: poolWasActive,
        pool,
      });

      await audit(req, {
        action: "event_transfer_lead",
        userId: req.payload._id,
        metadata: {
          eventShortId: event.shortId,
          title: event.title,
          from: previousOrganizer,
          to: req.payload._id,
          poolFrozen: poolWasActive,
          poolContributionCount: pool.count,
          poolTotalCents: pool.total,
        },
      });
      if (poolWasActive) {
        await audit(req, {
          action: "pool_freeze",
          userId: previousOrganizer,
          metadata: {
            eventShortId: event.shortId,
            cause: "lead_transferred",
          },
        });
      }

      const [me, old] = await Promise.all([
        User.findById(req.payload._id).select("name surname"),
        User.findById(previousOrganizer).select("name surname"),
      ]);
      const newName = `${me?.name || ""} ${me?.surname || ""}`.trim() || "Un participant";
      const oldName = `${old?.name || ""} ${old?.surname || ""}`.trim() || "L'ancien organisateur";

      await notify(req.app, {
        userId: previousOrganizer,
        type: "event_transfer_accepted",
        data: {
          eventTitle: event.title,
          eventShortId: event.shortId,
          fromName: newName,
        },
        link: `/event/${event.shortId}`,
      });
      await sendPushToUser(previousOrganizer, {
        title: `🤝 ${newName} reprend l'organisation`,
        body: `« ${event.title} » — tu restes participant`,
        url: `/event/${event.shortId}`,
        tag: `event-transfer-accepted-${event.shortId}`,
        type: "events",
      });

      // ── Tous les autres participants ──────────────────────────────────────
      // Le message dit explicitement ce qu'il advient de l'argent déjà versé.
      // Sans cette phrase, les contributeurs supposent que leur contribution
      // « suit » l'événement — ce qui est faux, et ce que l'app ne peut pas
      // garantir : c'est un engagement entre deux personnes.
      const invitations = await EventInvitation.find({ event: event._id });
      const poolLine =
        pool.count > 0
          ? ` Les ${(pool.total / 100).toFixed(2)} € déjà versés restent sur le compte de ${oldName}, qui s'organise avec ${newName}.`
          : "";

      for (const inv of invitations) {
        if (!inv.user) continue;
        const uid = inv.user.toString();
        if (uid === previousOrganizer || uid === req.payload._id) continue;
        await notify(req.app, {
          userId: inv.user,
          type: "event_transfer_done",
          data: {
            eventTitle: event.title,
            eventShortId: event.shortId,
            fromName: oldName,
            toName: newName,
            poolTotal: pool.total,
            poolCount: pool.count,
            message: `${oldName} a confié l'organisation de « ${event.title} » à ${newName}.${poolLine}`,
          },
          link: `/event/${event.shortId}`,
        });
        await sendPushToUser(inv.user, {
          title: `🤝 Nouvel organisateur — ${event.title}`,
          body: `${oldName} a passé la main à ${newName}`,
          url: `/event/${event.shortId}`,
          tag: `event-transfer-done-${event.shortId}`,
          type: "events",
        });
      }

      req.app
        .get("io")
        ?.to(`event:${event.shortId}`)
        .emit("event:transfer_done", {
          shortId: event.shortId,
          organizerId: event.organizer.toString(),
        });
    } catch (error) {
      console.error("❌ Error accepting lead transfer:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  },
);

module.exports = router;
