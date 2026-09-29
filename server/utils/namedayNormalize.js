/**
 * namedayNormalize.js
 *
 * Normalisation des prénoms pour la recherche de fête.
 * Partagée par le helper (lecture) et le script de build (écriture),
 * pour que les clés générées et les clés cherchées soient identiques.
 *
 * ⚠️ Copie conforme dans mobile/src/lib/nameday.ts — garder les deux alignées.
 */

/** "  Raphaël " → "raphael" ; "Gabriel-Henri" → "gabriel-henri" */
function stripName(name) {
  return String(name || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s*-\s*/g, "-")
    .replace(/[^a-z-]/g, "");
}

/** Clés d'index d'un prénom : version accentuée + version sans accents. */
function nameKeys(name) {
  const lower = String(name || "").trim().toLowerCase();
  return [...new Set([lower, stripName(name)])].filter(Boolean);
}

/**
 * Candidats de recherche pour le prénom d'un contact, du plus précis au plus large :
 * "Gabriel-Henri" → ["gabriel-henri", "gabriel"]
 * La comparaison se fait ensuite à l'identique (pas de includes / startsWith).
 */
function searchCandidates(firstName) {
  const full = stripName(firstName);
  if (!full) return [];
  const candidates = [full];
  if (full.includes("-")) candidates.push(full.split("-")[0]);
  return candidates.filter(Boolean);
}

module.exports = { stripName, nameKeys, searchCandidates };
