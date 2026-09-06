import { useEffect, useState } from "react";
import * as SecureStore from "expo-secure-store";

/**
 * Rappels posés sur les entrées que BirthReminder écrit dans le calendrier
 * natif du téléphone.
 *
 * ⚠️ Pourquoi ce fichier existe. `Calendar.createEventAsync()` était appelé
 * sans champ `alarms` : iOS et Android ne posent alors AUCUN rappel, et
 * l'entrée ne se signalait qu'à l'heure de l'événement. Ce n'était pas un
 * comportement d'Apple ou de Google — c'était nous qui ne demandions rien.
 *
 * Réglage LOCAL À L'APPAREIL (SecureStore), même principe que stats-scope :
 * il ne décrit pas l'utilisateur mais ce que cette application écrit dans le
 * calendrier de CE téléphone. Le stocker côté serveur obligerait en plus à un
 * aller-retour réseau au moment d'appuyer sur « Ajouter au calendrier », donc
 * à échouer hors ligne, pour un réglage qui n'a de sens que localement.
 *
 * Unité : minutes, comme `Calendar.Alarm.relativeOffset`. Négatif = avant le
 * début de l'entrée, positif = après.
 */

/** Rappels pour une entrée AVEC HEURE (les événements). Toujours négatifs. */
export const TIMED_CHOICES = [
  { minutes: -10080, label: "1 semaine avant" },
  { minutes: -2880, label: "2 jours avant" },
  { minutes: -1440, label: "1 jour avant" },
  { minutes: -120, label: "2 h avant" },
  { minutes: -60, label: "1 h avant" },
  { minutes: -30, label: "30 min avant" },
  { minutes: 0, label: "À l'heure" },
] as const;

/**
 * Rappels pour une entrée EN JOURNÉE ENTIÈRE (anniversaires, fêtes).
 *
 * Une journée entière commence à minuit : un décalage de 0 réveillerait donc
 * l'utilisateur à 00 h 00, ce qui n'a aucun intérêt pour un anniversaire. Les
 * valeurs utiles se lisent donc en heure d'horloge — « la veille à 18 h » vaut
 * −6 h, « le jour à 9 h » vaut +9 h (positif : après le début).
 */
export const ALL_DAY_CHOICES = [
  { minutes: -10080, label: "1 semaine avant" },
  { minutes: -1440, label: "La veille, à minuit" },
  { minutes: -360, label: "La veille, à 18 h" },
  { minutes: 480, label: "Le jour même, à 8 h" },
  { minutes: 540, label: "Le jour même, à 9 h" },
  { minutes: 720, label: "Le jour même, à midi" },
] as const;

export interface CalendarPrefs {
  /** Événements datés. */
  timed: number[];
  /** Anniversaires et fêtes (journée entière). */
  allDay: number[];
}

export const DEFAULT_CALENDAR_PREFS: CalendarPrefs = {
  timed: [-1440, -60], // 1 jour avant + 1 h avant
  allDay: [-360, 540], // la veille 18 h + le jour même 9 h
};

const KEY = "calendar_prefs";

let prefs: CalendarPrefs = DEFAULT_CALENDAR_PREFS;
let loaded = false;
const listeners = new Set<(p: CalendarPrefs) => void>();

function emit() {
  listeners.forEach((l) => l(prefs));
}

/** Garde uniquement des minutes connues, dédoublonnées et triées. */
function sanitize(list: unknown, allowed: readonly number[]): number[] | null {
  if (!Array.isArray(list)) return null;
  const out = [
    ...new Set(list.filter((m): m is number => allowed.includes(m as number))),
  ];
  return out.sort((a, b) => a - b);
}

async function ensureLoaded(): Promise<void> {
  if (loaded) return;
  loaded = true;
  try {
    const saved = await SecureStore.getItemAsync(KEY);
    if (!saved) return;
    const parsed = JSON.parse(saved);
    const timed = sanitize(
      parsed?.timed,
      TIMED_CHOICES.map((c) => c.minutes),
    );
    const allDay = sanitize(
      parsed?.allDay,
      ALL_DAY_CHOICES.map((c) => c.minutes),
    );
    // Une liste vide est un choix légitime (« aucun rappel »), on ne la
    // remplace donc pas par les valeurs par défaut : seul un contenu illisible
    // (null) fait retomber sur celles-ci.
    prefs = {
      timed: timed ?? DEFAULT_CALENDAR_PREFS.timed,
      allDay: allDay ?? DEFAULT_CALENDAR_PREFS.allDay,
    };
    emit();
  } catch {
    // Préférence illisible → on garde les valeurs par défaut.
  }
}

export function getCalendarPrefs(): CalendarPrefs {
  return prefs;
}

/**
 * Les rappels sont lus au moment d'écrire dans le calendrier, donc juste après
 * un appui sur un bouton. Cette fonction garantit que SecureStore a été lu au
 * moins une fois, même si l'écran de réglages n'a jamais été ouvert.
 */
export async function loadCalendarPrefs(): Promise<CalendarPrefs> {
  await ensureLoaded();
  return prefs;
}

export function setCalendarPrefs(next: CalendarPrefs): void {
  prefs = {
    timed: [...next.timed].sort((a, b) => a - b),
    allDay: [...next.allDay].sort((a, b) => a - b),
  };
  loaded = true;
  emit();
  SecureStore.setItemAsync(KEY, JSON.stringify(prefs)).catch(() => {});
}

/** Ajoute ou retire un rappel d'une des deux listes. */
export function toggleCalendarPref(
  kind: "timed" | "allDay",
  minutes: number,
): void {
  const current = prefs[kind];
  const next = current.includes(minutes)
    ? current.filter((m) => m !== minutes)
    : [...current, minutes];
  setCalendarPrefs({ ...prefs, [kind]: next });
}

/** Hook réactif : l'écran de réglages se met à jour sans remontage. */
export function useCalendarPrefs(): CalendarPrefs {
  const [value, setValue] = useState<CalendarPrefs>(prefs);

  useEffect(() => {
    const listener = (p: CalendarPrefs) => setValue(p);
    listeners.add(listener);
    ensureLoaded().then(() => setValue(prefs));
    return () => {
      listeners.delete(listener);
    };
  }, []);

  return value;
}
