/**
 * namedayNormalize.js
 *
 * Normalisation des prénoms pour la recherche de fête.
 * Partagée par le helper (lecture) et le script de build (écriture),
 * pour que les clés générées et les clés cherchées soient identiques.
 *
 * ⚠️ Copie conforme dans mobile/src/lib/nameday.ts — garder les deux alignées.
 */

/**
 * "  Raphaël " → "raphael" ; "Gabriel-Henri" → "gabriel-henri"
 * "Jean marc" → "jean-marc" : l'espace entre deux prénoms compte comme un
 * tiret, sinon « Jean marc » devenait « jeanmarc » et n'était jamais fêté.
 */
function stripName(name) {
  return String(name || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s*-\s*|\s+/g, "-")
    .replace(/[^a-z-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Clés d'index d'un prénom : version accentuée + version sans accents. */
function nameKeys(name) {
  const lower = String(name || "").trim().toLowerCase();
  return [...new Set([lower, stripName(name)])].filter(Boolean);
}

/**
 * Candidats de recherche pour le prénom d'un contact, dans l'ordre d'essai :
 *
 *   1. le prénom entier            "jean-marc"   (s'il a sa ligne, il gagne)
 *   2. composés en « Jean- » :     "luc"         (Jean-Luc → saint Luc, 18/10)
 *      le deuxième prénom — Jean est partout, l'usage fête plutôt l'autre
 *   3. le premier prénom           "gabriel"     (Gabriel-Henri → 29/09)
 *
 * La comparaison se fait ensuite à l'identique (pas de includes / startsWith).
 * ⚠️ Copie conforme dans mobile/src/lib/nameday.ts.
 */
function searchCandidates(firstName) {
  const full = stripName(firstName);
  if (!full) return [];
  const candidates = [full];
  if (full.includes("-")) {
    const [first, second] = full.split("-");
    if (first === "jean" && second) candidates.push(second);
    candidates.push(first);
  }
  return candidates.filter(Boolean);
}

module.exports = { stripName, nameKeys, searchCandidates };
