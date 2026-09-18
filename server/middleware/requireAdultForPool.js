// middleware/requireAdultForPool.js
//
// Bloque toute OUVERTURE d'un moyen de collecter de l'argent : compte Stripe,
// cagnotte, RIB, PayPal, cagnotte sur un autre service. Les règles (âge,
// délai après changement de date de naissance, blocage admin) sont dans
// services/poolEligibility.js.
//
// Fermer reste toujours permis (désactiver, supprimer un RIB, rembourser) :
// on ne doit jamais empêcher quelqu'un d'arrêter une collecte.
//
// Usage :
//   requireAdultForPool()                         → contrôle systématique
//   requireAdultForPool((req) => req.body.enabled === true)
//                                                 → seulement à l'activation

const userModel = require("../models/user.model");
const { POOL_MIN_AGE } = require("../utils/age");
const { getPoolEligibility } = require("../services/poolEligibility");

function responseFor(reason, until) {
  switch (reason) {
    case "minor":
      return {
        code: "MINOR_NOT_ALLOWED",
        message: `La cagnotte est réservée aux personnes majeures. Tu pourras en ouvrir une à partir de tes ${POOL_MIN_AGE} ans.`,
      };
    case "birthdate_missing":
      return {
        code: "BIRTHDATE_REQUIRED",
        message:
          "Renseigne ta date de naissance dans ton profil pour ouvrir une cagnotte.",
      };
    case "birthdate_cooldown":
      return {
        code: "BIRTHDATE_COOLDOWN",
        until,
        message: `Ta date de naissance a été modifiée récemment : tu pourras ouvrir une cagnotte à partir du ${new Date(until).toLocaleDateString("fr-FR")}.`,
      };
    default:
      return {
        code: "POOL_BLOCKED",
        message:
          "L'ouverture de cagnottes est suspendue pour ton compte. Contacte le support pour en savoir plus.",
      };
  }
}

function requireAdultForPool(shouldCheck = () => true) {
  return async (req, res, next) => {
    try {
      if (!shouldCheck(req)) return next();

      const user = await userModel.findById(req.payload._id, "birthDate").lean();
      if (!user) return res.status(401).json({ message: "Utilisateur introuvable" });

      const { canCreatePool, poolBlockedReason, poolBlockedUntil } =
        await getPoolEligibility(user);
      if (!canCreatePool) {
        return res.status(403).json(responseFor(poolBlockedReason, poolBlockedUntil));
      }
      return next();
    } catch (err) {
      console.error("❌ [requireAdultForPool]", err);
      return res.status(500).json({ message: "Erreur serveur" });
    }
  };
}

module.exports = { requireAdultForPool };
