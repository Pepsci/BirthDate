// utils/age.js
//
// Âges légaux utilisés par l'application.
//   - 15 ans : création de compte (RGPD France, voir routes/auth.js)
//   - 18 ans : collecte d'argent (cagnotte Stripe, RIB, PayPal, cagnotte
//     externe). Un utilisateur de 15-17 ans garde tout le reste de l'app.

const POOL_MIN_AGE = 18;

/**
 * Âge révolu à la date `now`.
 * Calculé en UTC : une date de naissance est stockée à minuit UTC
 * (new Date("2008-09-18")), un calcul en heure locale peut la décaler d'un jour.
 * @returns {number|null} null si la date est absente ou invalide
 */
function ageFrom(birthDate, now = new Date()) {
  if (!birthDate) return null;
  const b = new Date(birthDate);
  if (isNaN(b.getTime())) return null;
  let age = now.getUTCFullYear() - b.getUTCFullYear();
  const beforeBirthday =
    now.getUTCMonth() < b.getUTCMonth() ||
    (now.getUTCMonth() === b.getUTCMonth() && now.getUTCDate() < b.getUTCDate());
  if (beforeBirthday) age -= 1;
  return age;
}

/**
 * Raison pour laquelle l'utilisateur ne peut pas ouvrir de cagnotte,
 * ou null s'il le peut.
 * @returns {"minor"|"birthdate_missing"|null}
 */
function poolBlockedReason(birthDate, now = new Date()) {
  const age = ageFrom(birthDate, now);
  if (age === null) return "birthdate_missing";
  if (age < POOL_MIN_AGE) return "minor";
  return null;
}

module.exports = { POOL_MIN_AGE, ageFrom, poolBlockedReason };
