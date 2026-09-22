import FR from "../data/namedays-fr-by-name.json";
import US from "../data/namedays-us-by-name.json";

/**
 * Fête d'un prénom, calculée sur le téléphone — utilisée en mode local.
 *
 * ⚠️ Copie conforme de server/utils/namedayHelper.js (même normalisation,
 * même ordre de recherche FR → US) : une carte doit avoir la même fête
 * qu'elle soit créée avec ou sans compte, sinon l'import vers un compte
 * (étape 6) ferait apparaître des différences.
 * Les deux JSON sont copiés depuis server/data/ : à resynchroniser si le
 * dictionnaire serveur change.
 */

type Index = Record<string, string>;

/**
 * "Jean-Marie" → ["jean-marie", "jean"] ; "José" → ["josé", "jose"]
 */
function normalizeFirstName(firstName: string): string[] {
  const lower = firstName.toLowerCase().trim();
  const norm = lower
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z-]/g, "");

  const candidates = new Set([lower, norm]);
  if (lower.includes("-")) {
    candidates.add(lower.split("-")[0]);
    candidates.add(norm.split("-")[0]);
  }
  return [...candidates].filter(Boolean);
}

function lookup(index: Index, candidates: string[]): string | null {
  for (const c of candidates) if (index[c]) return index[c];
  return null;
}

/** Fête au format "MM-DD", ou null si le prénom est inconnu. */
export function findNameDay(firstName: string | null | undefined): string | null {
  if (!firstName) return null;
  const candidates = normalizeFirstName(firstName);
  return lookup(FR as Index, candidates) ?? lookup(US as Index, candidates);
}
