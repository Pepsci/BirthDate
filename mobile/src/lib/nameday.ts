import FR from "../data/namedays-fr-by-name.json";

/**
 * Fête d'un prénom, calculée sur le téléphone : utilisée en mode local.
 *
 * ⚠️ Copie conforme de server/utils/namedayHelper.js + namedayNormalize.js
 * (même normalisation, même règle) : une carte doit avoir la même fête
 * qu'elle soit créée avec ou sans compte, sinon l'import vers un compte
 * ferait apparaître des différences.
 *
 * L'index est généré par server/scripts/build-namedays.js (qui écrit aussi
 * cette copie) : ne pas l'éditer à la main, éditer server/data/namedays/fr.json.
 *
 * Plus de repli sur le calendrier US : un prénom absent du calendrier
 * français n'a pas de fête (l'ancien repli fêtait « Mia » le 29/09).
 */

type Index = Record<string, string>;

/** "  Raphaël " → "raphael" ; "Jean marc" → "jean-marc" (espace = tiret) */
function stripName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s*-\s*|\s+/g, "-")
    .replace(/[^a-z-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Ordre d'essai (copie de server/utils/namedayNormalize.js) :
 * prénom entier ("jean-marc") → pour « Jean-… », le deuxième prénom ("luc")
 * → le premier prénom ("gabriel" pour Gabriel-Henri). Comparés à l'identique.
 */
function searchCandidates(firstName: string): string[] {
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

/** Fête au format "MM-DD", ou null si le prénom n'est pas fêté. */
export function findNameDay(firstName: string | null | undefined): string | null {
  if (!firstName) return null;
  const index = FR as Index;
  for (const c of searchCandidates(firstName)) if (index[c]) return index[c];
  return null;
}
