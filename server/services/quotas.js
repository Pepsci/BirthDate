// services/quotas.js
//
// Plafonds anti-abus : création d'événements et invitations par email.
//
// Pourquoi ici et pas dans un rate-limit Express : ces plafonds ne comptent pas
// des requêtes mais des OBJETS (événements créés, emails réellement envoyés),
// par compte et non par adresse IP, et l'un d'eux se règle utilisateur par
// utilisateur depuis l'admin. Le comptage s'appuie sur le journal d'audit :
// supprimer un événement ne rend donc pas de crédit de création.
//
// Les admins ne sont soumis à aucun de ces plafonds.

const Event = require("../models/event.model");
const EventInvitation = require("../models/eventInvitation.model");
const Log = require("../models/log.model");
const { audit } = require("./auditLog");
const { sendSupportEmail } = require("./emailTemplates/supportEmail");

const DAY_MS = 24 * 60 * 60 * 1000;

// Valeurs par défaut : un compte peut recevoir un quota propre depuis l'admin
// (User.eventQuota, bouton « Quota d'événements » de la fiche utilisateur).
const EVENT_DAILY_DEFAULT = 5; // créations par 24 h glissantes
const EVENT_ACTIVE_DEFAULT = 15; // événements en cours en même temps

const INVITE_PER_REQUEST = 20; // adresses par envoi
const INVITE_PER_EVENT = 50; // invités par email sur un même événement
const INVITE_PER_DAY = 100; // emails d'invitation par compte et par 24 h

const SUPPORT_HINT =
  "Besoin de plus ? Écrivez au support (Profil → Contacter le support) : le quota peut être augmenté.";

const since24h = () => new Date(Date.now() - DAY_MS);

/** « dans environ 3 h », calculé depuis l'entrée la plus ancienne de la fenêtre. */
function retryLabel(oldestAt) {
  if (!oldestAt) return "dans les prochaines 24 h";
  const ms = new Date(oldestAt).getTime() + DAY_MS - Date.now();
  if (ms <= 60 * 60 * 1000) return "dans moins d'une heure";
  return `dans environ ${Math.ceil(ms / (60 * 60 * 1000))} h`;
}

function eventQuotaOf(user) {
  const q = user?.eventQuota || {};
  return {
    daily: Number.isInteger(q.daily) ? q.daily : EVENT_DAILY_DEFAULT,
    active: Number.isInteger(q.active) ? q.active : EVENT_ACTIVE_DEFAULT,
    custom: Number.isInteger(q.daily) || Number.isInteger(q.active),
  };
}

/** Événements « en cours » : ni annulés ni terminés, et pas encore passés. */
function countActiveEvents(userId) {
  const now = new Date();
  return Event.countDocuments({
    organizer: userId,
    status: { $in: ["draft", "published"] },
    $or: [
      { selectedDate: { $gte: now } },
      { selectedDate: null, fixedDate: { $gte: now } },
      { selectedDate: null, fixedDate: null }, // date encore au vote
    ],
  });
}

function eventCreationsLast24h(userId) {
  return Log.find({
    userId,
    action: "event_create",
    createdAt: { $gte: since24h() },
  })
    .sort({ createdAt: 1 })
    .select("createdAt")
    .lean();
}

async function externalInvitesLast24h(userId) {
  const rows = await Log.find({
    userId,
    action: "event_invite_external",
    createdAt: { $gte: since24h() },
  })
    .sort({ createdAt: 1 })
    .select("createdAt metadata.count")
    .lean();
  return {
    sent: rows.reduce((sum, r) => sum + (Number(r.metadata?.count) || 0), 0),
    oldestAt: rows[0]?.createdAt || null,
  };
}

/**
 * Trace un refus et prévient le support.
 *
 * Chaque refus est journalisé (onglet Logs de l'admin, action `quota_refused`).
 * L'email d'alerte, lui, ne part qu'UNE fois par compte, par type de quota et
 * par 24 h : quelqu'un qui insiste sur le bouton ne doit pas inonder la boîte
 * du support. Jamais bloquant : un échec d'envoi n'empêche pas la réponse.
 */
async function reportQuotaRefusal(req, user, kind, detail) {
  try {
    const alreadyAlerted = await Log.exists({
      userId: user._id,
      action: "quota_refused",
      "metadata.kind": kind,
      createdAt: { $gte: since24h() },
    });
    await audit(req, {
      action: "quota_refused",
      userId: user._id,
      metadata: { kind, ...detail },
    });
    if (alreadyAlerted) return;
    await sendSupportEmail({
      fromEmail: user.email,
      fromName: `${user.name} ${user.surname || ""}`.trim(),
      subject: `⚠️ Quota atteint [${kind}] : ${user.email}`,
      message:
        `Un compte vient d'atteindre un plafond anti-abus.\n\n` +
        `Compte : ${user.name} ${user.surname || ""} (${user.email}) : ${user._id}\n` +
        `Quota : ${kind}\n` +
        `Détail : ${JSON.stringify(detail)}\n\n` +
        `Rien à faire si l'usage est normal. Si la personne demande plus ` +
        `d'événements : admin → Utilisateurs → sa fiche → « Quota d'événements ». ` +
        `Les refus suivants sont visibles dans admin → Logs (quota_refused).`,
    });
  } catch (err) {
    console.error("⚠️ [QUOTA] signalement du refus impossible :", err.message);
  }
}

/**
 * Peut-on créer un événement ? Renvoie null si oui, sinon
 * { status, code, message } à renvoyer tel quel au client.
 */
async function checkEventCreation(req, user) {
  if (user.role === "admin") return null;
  const quota = eventQuotaOf(user);

  const creations = await eventCreationsLast24h(user._id);
  if (creations.length >= quota.daily) {
    await reportQuotaRefusal(req, user, "event_daily", {
      limit: quota.daily,
      created: creations.length,
    });
    return {
      status: 429,
      code: "EVENT_QUOTA_DAILY",
      message:
        `Vous avez atteint votre quota journalier : ${quota.daily} événements créés sur 24 h. ` +
        `Vous pourrez en créer un nouveau ${retryLabel(creations[0]?.createdAt)}. ${SUPPORT_HINT}`,
    };
  }

  const active = await countActiveEvents(user._id);
  if (active >= quota.active) {
    await reportQuotaRefusal(req, user, "event_active", {
      limit: quota.active,
      active,
    });
    return {
      status: 429,
      code: "EVENT_QUOTA_ACTIVE",
      message:
        `Vous avez atteint la limite de ${quota.active} événements en cours. ` +
        `Annulez ou supprimez-en un pour en créer un nouveau : les événements passés ne comptent pas. ${SUPPORT_HINT}`,
    };
  }
  return null;
}

/** Nettoie une liste d'adresses reçue du client : minuscules, format, doublons. */
function cleanEmails(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  for (const raw of list) {
    if (typeof raw !== "string") continue;
    const email = raw.trim().toLowerCase();
    if (email.length > 254) continue;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) continue;
    seen.add(email);
  }
  return [...seen];
}

/**
 * Peut-on envoyer `newCount` NOUVELLES invitations par email sur cet événement ?
 * (`requested` = adresses valides de la demande, `newCount` = celles qui ne
 * sont pas déjà invitées.) Renvoie null si oui, sinon { status, code, message }.
 */
async function checkExternalInvites(req, user, event, requested, newCount) {
  if (user.role === "admin") return null;

  if (requested > INVITE_PER_REQUEST) {
    return {
      status: 400,
      code: "INVITE_TOO_MANY",
      message: `${INVITE_PER_REQUEST} adresses email maximum par envoi. Envoyez vos invitations en plusieurs fois.`,
    };
  }
  if (newCount === 0) return null;

  const onEvent = await EventInvitation.countDocuments({
    event: event._id,
    externalEmail: { $type: "string" },
  });
  if (onEvent + newCount > INVITE_PER_EVENT) {
    const left = Math.max(0, INVITE_PER_EVENT - onEvent);
    await reportQuotaRefusal(req, user, "invite_event", {
      eventShortId: event.shortId,
      limit: INVITE_PER_EVENT,
      alreadyInvited: onEvent,
      requested: newCount,
    });
    return {
      status: 429,
      code: "INVITE_QUOTA_EVENT",
      message:
        `Cet événement a atteint sa limite de ${INVITE_PER_EVENT} invitations par email ` +
        `(il en reste ${left}). Vos invités peuvent toujours rejoindre l'événement avec ` +
        `le lien et le code d'accès, à partager par message. ${SUPPORT_HINT}`,
    };
  }

  const { sent, oldestAt } = await externalInvitesLast24h(user._id);
  if (sent + newCount > INVITE_PER_DAY) {
    const left = Math.max(0, INVITE_PER_DAY - sent);
    await reportQuotaRefusal(req, user, "invite_daily", {
      eventShortId: event.shortId,
      limit: INVITE_PER_DAY,
      sentLast24h: sent,
      requested: newCount,
    });
    return {
      status: 429,
      code: "INVITE_QUOTA_DAILY",
      message:
        `Vous avez atteint votre quota journalier d'invitations par email ` +
        `(${INVITE_PER_DAY} sur 24 h, il vous en reste ${left}). Il se renouvelle ` +
        `${retryLabel(oldestAt)}. En attendant, vos invités peuvent rejoindre ` +
        `l'événement avec le lien et le code d'accès, à partager par message. ${SUPPORT_HINT}`,
    };
  }
  return null;
}

module.exports = {
  EVENT_DAILY_DEFAULT,
  EVENT_ACTIVE_DEFAULT,
  INVITE_PER_REQUEST,
  INVITE_PER_EVENT,
  INVITE_PER_DAY,
  eventQuotaOf,
  countActiveEvents,
  eventCreationsLast24h,
  externalInvitesLast24h,
  checkEventCreation,
  checkExternalInvites,
  cleanEmails,
};
