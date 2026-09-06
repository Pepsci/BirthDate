const Log = require("../models/log.model");

/**
 * Écriture du journal d'audit.
 *
 * Pourquoi un service plutôt que le middleware `logAction` existant : celui-ci
 * ne sait consigner qu'une action nommée, sans contexte, et seulement en amont
 * d'une route. Or ce qu'on veut retrouver six mois plus tard, c'est « qui a
 * annulé QUEL événement, quand, et pour quel motif » — donc des métadonnées,
 * écrites APRÈS que l'action a réussi. Le middleware reste en place pour les
 * actions de compte.
 *
 * ⚠️ Jamais bloquant. Une écriture de journal qui échoue ne doit pas faire
 * échouer l'action qu'elle décrit : à ce stade elle est déjà enregistrée en
 * base, et la refuser laisserait le système dans un état pire que l'absence de
 * trace. Toute erreur est donc avalée et signalée en console.
 */

const YEAR_MS = 365 * 24 * 60 * 60 * 1000;

/**
 * Actions conservées indéfiniment : elles engagent des personnes entre elles,
 * et parfois de l'argent. Une trace de remboursement qui s'efface au bout d'un
 * an ne vaut rien le jour où quelqu'un conteste.
 */
const PERMANENT_ACTIONS = new Set([
  "event_cancel",
  "event_uncancel",
  "event_delete",
  "event_transfer_lead",
  "pool_enable",
  "pool_disable",
  "pool_freeze",
  "pool_refund",
  "bankinfo_set",
  "bankinfo_delete",
]);

/** IP réelle derrière un proxy / load balancer. */
function clientIp(req) {
  if (!req) return "system";
  return (
    req.headers?.["x-forwarded-for"]?.split(",")[0].trim() ||
    req.headers?.["x-real-ip"] ||
    req.connection?.remoteAddress ||
    req.socket?.remoteAddress ||
    "system"
  );
}

/**
 * @param {object|null} req    requête Express, ou null pour une écriture système
 *                             (webhook Stripe, cron) — l'IP vaut alors "system".
 * @param {object} opts
 * @param {string} opts.action        valeur de l'enum de log.model.js
 * @param {string} opts.userId        auteur de l'action. Pour un webhook, on
 *                                    consigne l'organisateur : c'est le compte
 *                                    concerné par le mouvement d'argent.
 * @param {object} [opts.metadata]    contexte libre (eventShortId, montants,
 *                                    motif, ancien/nouvel organisateur…)
 */
async function audit(req, { action, userId, metadata = {} }) {
  try {
    if (!userId) {
      console.error(`❌ [AUDIT] ${action} sans userId — non consigné`);
      return null;
    }
    return await Log.create({
      userId,
      action,
      ipAddress: clientIp(req),
      userAgent: req?.headers?.["user-agent"],
      metadata,
      // Absent = jamais purgé (voir le champ expiresAt dans log.model.js).
      expiresAt: PERMANENT_ACTIONS.has(action)
        ? null
        : new Date(Date.now() + YEAR_MS),
    });
  } catch (err) {
    console.error(`❌ [AUDIT] échec d'écriture (${action}):`, err.message);
    return null;
  }
}

module.exports = { audit, PERMANENT_ACTIONS };
