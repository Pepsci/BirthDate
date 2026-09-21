import { useSyncExternalStore } from "react";

/**
 * État réseau vu par l'app : « le serveur a-t-il répondu à la dernière
 * requête ? ».
 *
 * ⚠️ Volontairement déduit des appels réels (api.ts) plutôt que d'un module de
 * détection réseau : le Wi-Fi peut être « connecté » sans que le serveur soit
 * joignable (portail captif, serveur en panne). Ce qui compte pour
 * l'utilisateur, c'est de savoir si ce qu'il voit vient du serveur ou du cache.
 *
 * `lastSync` : date d'enregistrement des données de cache actuellement
 * affichées (renseignée quand un écran se rabat sur le cache).
 */

interface OfflineState {
  offline: boolean;
  lastSync: number | null;
}

let state: OfflineState = { offline: false, lastSync: null };
const listeners = new Set<() => void>();

function emit(next: OfflineState) {
  if (next.offline === state.offline && next.lastSync === state.lastSync) return;
  state = next;
  listeners.forEach((l) => l());
}

/** Le serveur vient de répondre (quel que soit le code HTTP). */
export function markOnline() {
  emit({ offline: false, lastSync: null });
}

/** Le serveur est injoignable (pas de réseau, délai dépassé). */
export function markOffline() {
  emit({ offline: true, lastSync: state.lastSync });
}

/** Des données de cache enregistrées à `savedAt` sont affichées. */
export function noteCacheServed(savedAt: number) {
  emit({ offline: state.offline, lastSync: savedAt });
}

export function isOffline(): boolean {
  return state.offline;
}

export function subscribeOfflineStatus(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useOfflineStatus(): OfflineState {
  return useSyncExternalStore(subscribeOfflineStatus, () => state);
}
