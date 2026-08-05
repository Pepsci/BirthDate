import { useEffect, useState } from "react";
import * as SecureStore from "expo-secure-store";

/**
 * Portée de l'encart de statistiques du welcome :
 * - "community" : chiffres de toute la communauté (défaut, aussi le seul mode
 *   possible quand personne n'est connecté) ;
 * - "personal"  : mêmes chiffres, mais calculés sur les proches de l'utilisateur.
 *
 * Préférence locale à l'appareil (SecureStore) : aucun champ côté serveur, donc
 * elle ne suit pas d'un téléphone à l'autre. Pilotée depuis Profil → Réglages.
 */
export type StatsScope = "community" | "personal";

const KEY = "stats_scope";

let scope: StatsScope = "community";
let loaded = false;
const listeners = new Set<(s: StatsScope) => void>();

function emit() {
  listeners.forEach((l) => l(scope));
}

/** Lecture SecureStore une seule fois par lancement, puis cache mémoire. */
async function ensureLoaded(): Promise<void> {
  if (loaded) return;
  loaded = true;
  try {
    const saved = await SecureStore.getItemAsync(KEY);
    if (saved === "personal" || saved === "community") {
      scope = saved;
      emit();
    }
  } catch {
    // pas de préférence lisible → on reste sur "community"
  }
}

export function getStatsScope(): StatsScope {
  return scope;
}

export function setStatsScope(next: StatsScope): void {
  if (next === scope) return;
  scope = next;
  loaded = true;
  emit();
  SecureStore.setItemAsync(KEY, next).catch(() => {});
}

/**
 * Hook réactif : tous les écrans montés voient le changement immédiatement
 * (le welcome se met à jour sans avoir à être remonté après un tour dans
 * les réglages).
 */
export function useStatsScope(): StatsScope {
  const [value, setValue] = useState<StatsScope>(scope);

  useEffect(() => {
    const listener = (s: StatsScope) => setValue(s);
    listeners.add(listener);
    ensureLoaded().then(() => setValue(scope));
    return () => {
      listeners.delete(listener);
    };
  }, []);

  return value;
}
