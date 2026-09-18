// services/poolEligibility.js
//
// Qui peut ouvrir une cagnotte (ou proposer RIB / PayPal / cagnotte externe) ?
// Quatre raisons de refus, dans cet ordre :
//   1. "minor"              — moins de 18 ans
//   2. "birthdate_missing"  — pas de date de naissance
//   3. "admin_blocked"      — bloqué par un admin (mineur signalé, fraude)
//   4. "birthdate_cooldown" — date de naissance passée de mineur à majeur il y
//                             a moins de 30 jours
//
// Seul point d'entrée pour cette décision : le middleware requireAdultForPool,
// /auth/verify, /users/me et l'admin passent tous par ici.

const PoolRestriction = require("../models/poolRestriction.model");
const { poolBlockedReason } = require("../utils/age");
const { audit } = require("./auditLog");

const BIRTHDATE_COOLDOWN_DAYS = 30;

function activeRestrictionQuery(userId, now = new Date()) {
  return {
    user: userId,
    liftedAt: null,
    $or: [{ until: null }, { until: { $gt: now } }],
  };
}

/** Restriction active la plus forte (blocage admin avant délai). */
async function findActiveRestriction(userId) {
  const list = await PoolRestriction.find(activeRestrictionQuery(userId)).lean();
  if (list.length === 0) return null;
  return (
    list.find((r) => r.kind === "admin_block") ||
    list.sort((a, b) => new Date(b.until) - new Date(a.until))[0]
  );
}

/**
 * @param {{_id, birthDate}} user
 * @returns {Promise<{canCreatePool: boolean, poolBlockedReason: string|null, poolBlockedUntil: Date|null}>}
 */
async function getPoolEligibility(user) {
  const ageReason = poolBlockedReason(user.birthDate);
  if (ageReason) {
    return { canCreatePool: false, poolBlockedReason: ageReason, poolBlockedUntil: null };
  }
  const restriction = await findActiveRestriction(user._id);
  if (restriction) {
    return {
      canCreatePool: false,
      poolBlockedReason:
        restriction.kind === "admin_block" ? "admin_blocked" : "birthdate_cooldown",
      poolBlockedUntil: restriction.until || null,
    };
  }
  return { canCreatePool: true, poolBlockedReason: null, poolBlockedUntil: null };
}

/**
 * À appeler APRÈS l'enregistrement d'un profil dont la date de naissance a
 * peut-être changé. Trace le changement, et pose le délai de 30 jours si le
 * compte vient de passer de mineur (ou sans date) à majeur.
 * Jamais bloquant pour la mise à jour du profil elle-même.
 */
async function onBirthDateChange(req, user, oldBirthDate) {
  try {
    const before = oldBirthDate ? new Date(oldBirthDate).getTime() : null;
    const after = user.birthDate ? new Date(user.birthDate).getTime() : null;
    if (before === after) return;

    const becameAdult =
      poolBlockedReason(oldBirthDate) !== null &&
      poolBlockedReason(user.birthDate) === null;

    await audit(req, {
      action: "birthdate_change",
      userId: user._id,
      metadata: {
        oldBirthDate: oldBirthDate || null,
        newBirthDate: user.birthDate || null,
        becameAdult,
      },
    });

    if (becameAdult) {
      const until = new Date(Date.now() + BIRTHDATE_COOLDOWN_DAYS * 24 * 3600 * 1000);
      await PoolRestriction.create({
        user: user._id,
        kind: "birthdate_cooldown",
        until,
        reason: "Date de naissance modifiée : passage de mineur à majeur",
      });
      console.log(`⏳ [POOL] délai de ${BIRTHDATE_COOLDOWN_DAYS} j posé pour ${user.email}`);
    }
  } catch (err) {
    console.error("❌ [POOL] onBirthDateChange:", err.message);
  }
}

module.exports = {
  BIRTHDATE_COOLDOWN_DAYS,
  activeRestrictionQuery,
  findActiveRestriction,
  getPoolEligibility,
  onBirthDateChange,
};
