/**
 * i18n — socle de traduction de l'app mobile.
 *
 * Ordre de résolution de la langue :
 *   1. choix manuel de l'utilisateur (expo-secure-store "br-lang")
 *   2. langue du téléphone : fr-* → "fr", tout le reste → "en"
 *   3. repli sur "fr"
 *
 * Le démarrage est synchrone (langue du téléphone) pour ne jamais bloquer le
 * splash ; le choix manuel, lu de façon asynchrone, est appliqué juste après.
 *
 * ⚠️ Tant que l'anglais n'est pas prêt, SUPPORTED_LANGUAGES ne contient que
 * "fr" : tout le monde voit l'app en français, rien ne change à l'écran.
 * Pour activer l'anglais : ajouter "en" au tableau (étape 4).
 *
 * Toute clé absente en anglais retombe automatiquement sur le français.
 */
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { getLocales } from "expo-localization";
import * as SecureStore from "expo-secure-store";

import frCommon from "./locales/fr/common.json";
import enCommon from "./locales/en/common.json";

export type AppLanguage = "fr" | "en";

export const SUPPORTED_LANGUAGES: AppLanguage[] = ["fr"];
export const DEFAULT_LANGUAGE: AppLanguage = "fr";
const STORAGE_KEY = "br-lang";

const resources = {
  fr: { common: frCommon },
  en: { common: enCommon },
};

function isSupported(lang: string | null | undefined): lang is AppLanguage {
  return !!lang && (SUPPORTED_LANGUAGES as string[]).includes(lang);
}

function detectDeviceLanguage(): AppLanguage {
  const code = getLocales()[0]?.languageCode?.toLowerCase() ?? "";
  return code === "fr" ? "fr" : "en";
}

function resolveInitialLanguage(): AppLanguage {
  const detected = detectDeviceLanguage();
  return isSupported(detected) ? detected : DEFAULT_LANGUAGE;
}

/** Applique le choix manuel enregistré, s'il existe. */
async function applyStoredLanguage() {
  try {
    const stored = await SecureStore.getItemAsync(STORAGE_KEY);
    if (isSupported(stored) && stored !== i18n.language) {
      await i18n.changeLanguage(stored);
    }
  } catch {
    // Keychain indisponible : on garde la langue détectée
  }
}

/** Choix manuel depuis les réglages. */
export async function changeLanguage(lang: AppLanguage) {
  if (!isSupported(lang)) return;
  try {
    await SecureStore.setItemAsync(STORAGE_KEY, lang);
  } catch {
    // le choix vaudra pour la session en cours
  }
  await i18n.changeLanguage(lang);
}

i18n.use(initReactI18next).init({
  resources,
  lng: resolveInitialLanguage(),
  fallbackLng: DEFAULT_LANGUAGE,
  supportedLngs: ["fr", "en"],
  defaultNS: "common",
  ns: ["common"],
  interpolation: { escapeValue: false },
  returnNull: false,
  saveMissing: __DEV__,
  missingKeyHandler: (lngs, ns, key) => {
    console.warn(`[i18n] clé manquante : ${ns}:${key} (${lngs.join(", ")})`);
  },
});

applyStoredLanguage();

export default i18n;
