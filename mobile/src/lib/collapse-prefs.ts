import { useEffect, useState } from "react";
import * as SecureStore from "expo-secure-store";

/**
 * Mémorise l'état replié/déplié des encarts d'un écran (ex : sections de la
 * page événement) pour qu'il survive à une navigation aller-retour.
 *
 * Même approche que `stats-scope.ts` : préférence locale à l'appareil
 * (SecureStore), pas de champ côté serveur. Une entrée par « clé d'écran »
 * (ex: shortId d'événement) qui regroupe l'état de toutes ses sections dans
 * un seul JSON, pour éviter de multiplier les clés SecureStore.
 */

const PREFIX = "collapse_prefs_";
const cache = new Map<string, Record<string, boolean>>();

async function readPrefs(scopeKey: string): Promise<Record<string, boolean>> {
  if (cache.has(scopeKey)) return cache.get(scopeKey)!;
  let prefs: Record<string, boolean> = {};
  try {
    const saved = await SecureStore.getItemAsync(PREFIX + scopeKey);
    if (saved) prefs = JSON.parse(saved);
  } catch {
    // JSON invalide ou lecture impossible → on repart d'un état vide
  }
  cache.set(scopeKey, prefs);
  return prefs;
}

function writePrefs(scopeKey: string, prefs: Record<string, boolean>): void {
  cache.set(scopeKey, prefs);
  SecureStore.setItemAsync(PREFIX + scopeKey, JSON.stringify(prefs)).catch(
    () => {},
  );
}

/**
 * Hook pour un encart replié/déplié persistant.
 *
 * @param scopeKey clé de l'écran (ex : `event_${shortId}`)
 * @param sectionKey clé de la section dans cet écran (ex : "pool", "invite")
 * @param defaultOpen valeur par défaut tant que rien n'est enregistré
 */
export function usePersistedCollapse(
  scopeKey: string,
  sectionKey: string,
  defaultOpen = true,
): [boolean, (next: boolean) => void] {
  const [open, setOpen] = useState(defaultOpen);

  useEffect(() => {
    let cancelled = false;
    readPrefs(scopeKey).then((prefs) => {
      if (!cancelled && sectionKey in prefs) setOpen(prefs[sectionKey]);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeKey, sectionKey]);

  const update = (next: boolean) => {
    setOpen(next);
    const prefs = { ...(cache.get(scopeKey) ?? {}), [sectionKey]: next };
    writePrefs(scopeKey, prefs);
  };

  return [open, update];
}
