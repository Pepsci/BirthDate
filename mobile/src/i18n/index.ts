/**
 * i18n — socle de traduction de l'app mobile.
 *
 * Ordre de résolution de la langue :
 *   1. choix manuel de l'utilisateur (expo-secure-store "br-lang")
 *   2. langue du téléphone : fr-* → "fr", tout le reste → "en"
 *   3. repli sur "fr"
 *
 * Tout est résolu de façon synchrone avant le premier rendu : l'app ne
 * s'affiche jamais dans une langue puis dans une autre.
 *
 * Utilisation : `import { t } from "@/i18n"` puis `t("date:deleteTitle")`.
 * `t` est une fonction ordinaire (pas un hook) : elle s'utilise aussi bien
 * dans un composant que dans `lib/`. En contrepartie, un changement de langue
 * remonte l'arbre de navigation (`useAppLanguage()` + `key` dans
 * `app/_layout.tsx`).
 *
 * ⚠️ Ne JAMAIS appeler `t()` au niveau module (constante globale, StyleSheet) :
 * la valeur serait figée dans la langue du démarrage. Passer par une fonction.
 *
 * Ajouter une langue : un dossier `locales/<code>/`, le code dans
 * `SUPPORTED_LANGUAGES`, une entrée dans `LOCALE_TAGS` et dans
 * `detectDeviceLanguage()`. Toute clé absente retombe sur le français.
 */
import i18n from "i18next";
import { useSyncExternalStore } from "react";
import { getLocales } from "expo-localization";
import * as SecureStore from "expo-secure-store";

import { NAMESPACES, resources } from "./locales";

export type AppLanguage = "fr" | "en";

export const SUPPORTED_LANGUAGES: AppLanguage[] = ["fr", "en"];
export const DEFAULT_LANGUAGE: AppLanguage = "fr";
const STORAGE_KEY = "br-lang";

/** Balise BCP 47 passée à `toLocaleDateString` & co. */
const LOCALE_TAGS: Record<AppLanguage, string> = {
  fr: "fr-FR",
  en: "en-GB",
};

function isSupported(lang: string | null | undefined): lang is AppLanguage {
  return !!lang && (SUPPORTED_LANGUAGES as string[]).includes(lang);
}

function detectDeviceLanguage(): AppLanguage {
  try {
    const code = getLocales()[0]?.languageCode?.toLowerCase() ?? "";
    return code === "fr" ? "fr" : "en";
  } catch {
    return DEFAULT_LANGUAGE;
  }
}

/** Choix manuel enregistré, ou `null` si l'app suit le téléphone. */
export function getStoredLanguage(): AppLanguage | null {
  try {
    const stored = SecureStore.getItem(STORAGE_KEY);
    return isSupported(stored) ? stored : null;
  } catch {
    return null; // Keychain indisponible : on suit le téléphone
  }
}

function resolveInitialLanguage(): AppLanguage {
  const stored = getStoredLanguage();
  if (stored) return stored;
  const detected = detectDeviceLanguage();
  return isSupported(detected) ? detected : DEFAULT_LANGUAGE;
}

i18n.init({
  resources,
  lng: resolveInitialLanguage(),
  fallbackLng: DEFAULT_LANGUAGE,
  supportedLngs: SUPPORTED_LANGUAGES,
  defaultNS: "common",
  ns: [...NAMESPACES],
  interpolation: { escapeValue: false },
  returnNull: false,
  initAsync: false,
  saveMissing: __DEV__,
  missingKeyHandler: (lngs, ns, key) => {
    console.warn(`[i18n] clé manquante : ${ns}:${key} (${lngs.join(", ")})`);
  },
});

/** Langue affichée en ce moment. */
export function getLanguage(): AppLanguage {
  return isSupported(i18n.language) ? i18n.language : DEFAULT_LANGUAGE;
}

/**
 * Pays réglé sur le téléphone ("FR", "DE"…), ou null s'il est inconnu.
 * Sert au serveur à choisir l'âge minimum du compte (server/utils/minAge.js).
 * Indépendant de la langue : un téléphone en anglais peut être réglé sur la
 * France.
 */
export function getRegion(): string | null {
  try {
    return getLocales()[0]?.regionCode?.toUpperCase() ?? null;
  } catch {
    return null;
  }
}

/** Balise de locale pour les dates et les nombres ("fr-FR", "en-GB"). */
export function getLocaleTag(): string {
  return LOCALE_TAGS[getLanguage()];
}

/** Traduit une clé "namespace:cle". */
export function t(key: string, options?: Record<string, unknown>): string {
  return i18n.t(key, options as never) as unknown as string;
}

/**
 * Pluriel : choisit `cle.one` ou `cle.other` et passe `count` au texte.
 * Fait à la main (et non par i18next) car Hermes n'embarque pas
 * `Intl.PluralRules`. En français 0 et 1 sont au singulier, en anglais
 * seul 1 l'est.
 */
export function tn(
  key: string,
  count: number,
  options?: Record<string, unknown>,
): string {
  const singular = getLanguage() === "fr" ? count < 2 : count === 1;
  return t(`${key}.${singular ? "one" : "other"}`, { count, ...options });
}

/**
 * Choix manuel depuis les réglages. `null` = suivre de nouveau le téléphone.
 */
export async function changeLanguage(lang: AppLanguage | null) {
  try {
    if (lang === null) await SecureStore.deleteItemAsync(STORAGE_KEY);
    else if (isSupported(lang)) await SecureStore.setItemAsync(STORAGE_KEY, lang);
  } catch {
    // le choix vaudra pour la session en cours
  }
  const next = lang ?? detectDeviceLanguage();
  if (isSupported(next) && next !== i18n.language) {
    await i18n.changeLanguage(next);
  }
}

/** "5 octobre" / "5 October" */
export function formatDayMonth(d: Date): string {
  return d.toLocaleDateString(getLocaleTag(), { day: "numeric", month: "long" });
}

/** "5 octobre 2026" / "5 October 2026" */
export function formatDayMonthYear(d: Date): string {
  return d.toLocaleDateString(getLocaleTag(), {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** Nom du mois (0 = janvier), dans la langue courante. */
export function monthName(
  month: number,
  style: "long" | "short" = "long",
): string {
  return new Date(2000, month, 1).toLocaleDateString(getLocaleTag(), {
    month: style,
  });
}

/** Nom du jour, 0 = lundi (la semaine de l'app commence le lundi). */
export function weekdayName(
  index: number,
  style: "long" | "short" | "narrow" = "long",
): string {
  // Le 1er janvier 2024 est un lundi.
  return new Date(2024, 0, 1 + index).toLocaleDateString(getLocaleTag(), {
    weekday: style,
  });
}

/** Première lettre en majuscule (les mois et jours français sont en minuscules). */
export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function subscribe(onChange: () => void) {
  i18n.on("languageChanged", onChange);
  return () => i18n.off("languageChanged", onChange);
}

/** Langue courante, réactive : sert de `key` à l'arbre de navigation. */
export function useAppLanguage(): AppLanguage {
  return useSyncExternalStore(subscribe, getLanguage, getLanguage);
}

export default i18n;
