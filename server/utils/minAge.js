// utils/minAge.js
//
// Âge minimum pour avoir un compte, selon le pays.
//
// LA RÈGLE (une seule, ici ; rien n'est écrit en dur ailleurs) :
//   - 15 ans : le plancher, partout. C'est le seuil français, et l'âge déclaré
//     dans les questionnaires des stores. On ne descend jamais en dessous,
//     même dans les pays qui autorisent 13 ou 14 ans.
//   - 16 ans : dans les pays qui l'exigent, ET partout où l'on ne sait pas
//     (pays inconnu ou hors de la liste). 16 ans est la valeur par défaut du
//     RGPD (article 8) : dans le doute, on prend la plus prudente.
//
// D'où une seule liste à tenir : les pays où 15 ans suffit. Tout le reste
// vaut 16. Seuils vérifiés en octobre 2026 ; un pays change sa loi → on
// l'ajoute ou on le retire de cette liste, c'est tout.
//
// Le pays n'est jamais demandé à l'utilisateur. Deux indices :
//   - la région réglée sur le téléphone (en-tête `X-App-Region`, app mobile) ;
//   - le pays de l'adresse IP.
// S'ils donnent des âges différents, on garde le plus élevé.
//
// ⚠️ Déclaratif et contournable (fausse date, VPN) : c'est le niveau attendu
// pour ce service, pas une vérification d'identité.
//
// Ne concerne pas la cagnotte : 18 ans partout, voir utils/age.js.

const geoip = require("geoip-country");

const BASE_MIN_AGE = 15;
const STRICT_MIN_AGE = 16;

/** Pays où 15 ans suffit (leur seuil légal est 13, 14 ou 15 ans). */
const COUNTRIES_WHERE_15_IS_ENOUGH = new Set([
  // Seuil légal 15 ans
  "FR", "GR", "CZ",
  // France d'outre-mer : même loi, mais un code pays à part
  "GP", "MQ", "GF", "RE", "YT", "PM", "BL", "MF", "NC", "PF", "WF",
  // Seuil légal 14 ans
  "AT", "BG", "CY", "ES", "IT", "LT",
  // Seuil légal 13 ans
  "BE", "DK", "EE", "FI", "LV", "MT", "PT", "SE", "GB",
]);
// Seuil légal 16 ans (rien à déclarer, c'est le cas par défaut) :
// DE, HR, HU, IE, LU, NL, PL, RO, SK, SI.

/** "fr", "FR ", "fr-FR" → "FR". null si ce n'est pas un code pays. */
function normalizeCountry(value) {
  const code = String(value || "")
    .trim()
    .toUpperCase()
    .split(/[-_]/)
    .pop();
  return /^[A-Z]{2}$/.test(code) ? code : null;
}

/** Âge minimum pour UN pays. Pays inconnu ou absent → 16. */
function minAgeForCountry(country) {
  const code = normalizeCountry(country);
  return code && COUNTRIES_WHERE_15_IS_ENOUGH.has(code)
    ? BASE_MIN_AGE
    : STRICT_MIN_AGE;
}

/** Pays d'une adresse IP, ou null (IP locale, inconnue de la base…). */
function countryFromIp(ip) {
  try {
    return normalizeCountry(geoip.lookup(ip)?.country);
  } catch (_) {
    return null;
  }
}

/**
 * Âge minimum à appliquer à partir des indices disponibles.
 * Un indice absent est ignoré ; s'il n'y en a aucun, c'est 16.
 * @returns {{ minAge: number, country: string|null }}
 *   `country` : le pays qui a fixé l'âge retenu (pour les journaux).
 */
function resolveMinAge({ region, ip } = {}) {
  const candidates = [normalizeCountry(region), countryFromIp(ip)].filter(
    Boolean,
  );
  if (candidates.length === 0) return { minAge: STRICT_MIN_AGE, country: null };

  let result = { minAge: 0, country: null };
  for (const country of candidates) {
    const minAge = minAgeForCountry(country);
    if (minAge > result.minAge) result = { minAge, country };
  }
  return result;
}

/** Même chose, à partir de la requête en cours. */
function minAgeForRequest(req) {
  return resolveMinAge({
    region: req?.headers?.["x-app-region"],
    ip: req?.ip,
  });
}

module.exports = {
  BASE_MIN_AGE,
  STRICT_MIN_AGE,
  minAgeForCountry,
  resolveMinAge,
  minAgeForRequest,
};
