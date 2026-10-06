import { getLanguage } from "@/i18n";

const SITE = "https://birthreminder.com";

/** Pages légales du site. Chacune existe en français et sous `/en/`. */
export type LegalPage = "cgu" | "privacy" | "cookies" | "mentions-legales";

/**
 * Adresse d'une page légale dans la langue de l'app.
 * Français : `/cgu`. Toute autre langue : `/en/cgu` (version anglaise).
 */
export function legalUrl(page: LegalPage): string {
  return getLanguage() === "fr" ? `${SITE}/${page}` : `${SITE}/en/${page}`;
}
