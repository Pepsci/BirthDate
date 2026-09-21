/**
 * i18n — socle de traduction du front web.
 *
 * Ordre de résolution de la langue :
 *   1. choix manuel de l'utilisateur (localStorage "br-lang")
 *   2. langue du navigateur : fr-* → "fr", tout le reste → "en"
 *   3. repli sur "fr"
 *
 * ⚠️ Tant que l'anglais n'est pas prêt, SUPPORTED_LANGUAGES ne contient que
 * "fr" : tout le monde voit l'app en français, rien ne change à l'écran.
 * Pour activer l'anglais : ajouter "en" au tableau (étape 4).
 *
 * Toute clé absente en anglais retombe automatiquement sur le français.
 */
import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import frCommon from "./locales/fr/common.json";
import enCommon from "./locales/en/common.json";

export const SUPPORTED_LANGUAGES = ["fr"];
export const DEFAULT_LANGUAGE = "fr";
const STORAGE_KEY = "br-lang";

const resources = {
  fr: { common: frCommon },
  en: { common: enCommon },
};

function readStoredLanguage() {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function detectBrowserLanguage() {
  const lang = (navigator.language || "").toLowerCase();
  return lang.startsWith("fr") ? "fr" : "en";
}

function resolveLanguage() {
  const stored = readStoredLanguage();
  if (stored && SUPPORTED_LANGUAGES.includes(stored)) return stored;

  const detected = detectBrowserLanguage();
  if (SUPPORTED_LANGUAGES.includes(detected)) return detected;

  return DEFAULT_LANGUAGE;
}

/** Choix manuel depuis les réglages. */
export function changeLanguage(lang) {
  if (!SUPPORTED_LANGUAGES.includes(lang)) return;
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    // stockage indisponible (navigation privée…) : le choix vaut pour la session
  }
  i18n.changeLanguage(lang);
}

i18n.on("languageChanged", (lng) => {
  document.documentElement.lang = lng;
});

i18n.use(initReactI18next).init({
  resources,
  lng: resolveLanguage(),
  fallbackLng: DEFAULT_LANGUAGE,
  supportedLngs: ["fr", "en"],
  defaultNS: "common",
  ns: ["common"],
  interpolation: { escapeValue: false }, // React échappe déjà
  returnNull: false,
  // En dev : signale dans la console toute clé introuvable
  saveMissing: import.meta.env.DEV,
  missingKeyHandler: (lngs, ns, key) => {
    console.warn(`[i18n] clé manquante : ${ns}:${key} (${lngs.join(", ")})`);
  },
});

export default i18n;
