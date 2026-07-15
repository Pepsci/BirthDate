// services/poolFraudService.js
// Détection de cagnottes suspectes par règles (scoring simple).
// Utilisé par la route admin /api/admin/pools/alerts et le cron poolFraudAlerts.

const Event = require("../models/event.model");
const GiftPoolContribution = require("../models/giftPoolContribution.model");

// Seuils "prudents" — surchargeables via variables d'env (montants en centimes)
const THRESHOLDS = {
  bigContribution: parseInt(process.env.FRAUD_BIG_CONTRIBUTION) || 25000, // 250 €
  bigTotal: parseInt(process.env.FRAUD_BIG_TOTAL) || 200000, // 2 000 €
  velocityCount: parseInt(process.env.FRAUD_VELOCITY_COUNT) || 10, // contributions
  velocityWindowMinutes: parseInt(process.env.FRAUD_VELOCITY_WINDOW) || 60, // fenêtre
  refundRatio: parseFloat(process.env.FRAUD_REFUND_RATIO) || 0.3, // 30 %
  refundMinCount: parseInt(process.env.FRAUD_REFUND_MIN_COUNT) || 3,
};

/*
 * Calcule les alertes en cours sur toutes les cagnottes.
 * Retourne un tableau d'alertes :
 * { type, severity ("high"|"medium"), event: {…}, details, amount? }
 */
async function computePoolAlerts() {
  const windowStart = new Date(
    Date.now() - THRESHOLDS.velocityWindowMinutes * 60 * 1000,
  );

  // Une seule agrégation : stats par event
  const stats = await GiftPoolContribution.aggregate([
    {
      $group: {
        _id: "$event",
        succeededTotal: {
          $sum: { $cond: [{ $eq: ["$status", "succeeded"] }, "$amount", 0] },
        },
        succeededCount: {
          $sum: { $cond: [{ $eq: ["$status", "succeeded"] }, 1, 0] },
        },
        refundedCount: {
          $sum: { $cond: [{ $eq: ["$status", "refunded"] }, 1, 0] },
        },
        maxContribution: {
          $max: { $cond: [{ $eq: ["$status", "succeeded"] }, "$amount", 0] },
        },
        recentCount: {
          $sum: { $cond: [{ $gte: ["$createdAt", windowStart] }, 1, 0] },
        },
      },
    },
  ]);

  const flagged = [];

  for (const s of stats) {
    const rules = [];

    if (s.maxContribution >= THRESHOLDS.bigContribution) {
      rules.push({
        type: "big_contribution",
        severity: "medium",
        amount: s.maxContribution,
        details: `Contribution unique de ${(s.maxContribution / 100).toFixed(2)} € (seuil : ${THRESHOLDS.bigContribution / 100} €)`,
      });
    }

    if (s.succeededTotal >= THRESHOLDS.bigTotal) {
      rules.push({
        type: "big_total",
        severity: "high",
        amount: s.succeededTotal,
        details: `Total collecté de ${(s.succeededTotal / 100).toFixed(2)} € (seuil : ${THRESHOLDS.bigTotal / 100} €)`,
      });
    }

    if (s.recentCount >= THRESHOLDS.velocityCount) {
      rules.push({
        type: "velocity",
        severity: "high",
        details: `${s.recentCount} contributions sur les ${THRESHOLDS.velocityWindowMinutes} dernières minutes (seuil : ${THRESHOLDS.velocityCount})`,
      });
    }

    const settled = s.succeededCount + s.refundedCount;
    if (
      s.refundedCount >= THRESHOLDS.refundMinCount &&
      settled > 0 &&
      s.refundedCount / settled >= THRESHOLDS.refundRatio
    ) {
      rules.push({
        type: "refund_ratio",
        severity: "medium",
        details: `${s.refundedCount} remboursement(s) sur ${settled} contributions (${Math.round((s.refundedCount / settled) * 100)} %)`,
      });
    }

    if (rules.length > 0) flagged.push({ eventId: s._id, rules, stats: s });
  }

  if (flagged.length === 0) return [];

  // Enrichir avec les infos event + organisateur
  const events = await Event.find({
    _id: { $in: flagged.map((f) => f.eventId) },
  })
    .select("shortId title type status organizer giftPool")
    .populate("organizer", "name surname email");

  const eventsById = {};
  events.forEach((e) => (eventsById[String(e._id)] = e));

  const alerts = [];
  flagged.forEach((f) => {
    const event = eventsById[String(f.eventId)];
    if (!event) return; // contributions orphelines (event supprimé)
    f.rules.forEach((r) =>
      alerts.push({
        ...r,
        event: {
          _id: event._id,
          shortId: event.shortId,
          title: event.title,
          status: event.status,
          poolActive: !!event.giftPool?.active,
          organizer: event.organizer
            ? {
                _id: event.organizer._id,
                name: event.organizer.name,
                surname: event.organizer.surname,
                email: event.organizer.email,
              }
            : null,
        },
        totals: {
          collected: f.stats.succeededTotal,
          contributions: f.stats.succeededCount,
          refunded: f.stats.refundedCount,
        },
      }),
    );
  });

  // High d'abord
  alerts.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "high" ? -1 : 1));
  return alerts;
}

module.exports = { computePoolAlerts, THRESHOLDS };
