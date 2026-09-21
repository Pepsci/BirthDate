import { NetworkError } from "./api";
import { readCache, writeCache } from "./offline-cache";
import { noteCacheServed } from "./offline-status";

/**
 * Lecture « avec filet » : appelle le serveur et enregistre la réponse ;
 * sans réseau (NetworkError uniquement), renvoie la dernière version
 * enregistrée. Une erreur HTTP (401, 404, 500…) n'est jamais masquée.
 *
 * Pour les données consultables hors ligne en lecture seule (événements…).
 * Les dates ont leur propre logique dans lib/dates.ts (file d'attente).
 */
export async function withOfflineCache<T>(
  key: string,
  fetcher: () => Promise<T>,
): Promise<T> {
  try {
    const data = await fetcher();
    writeCache(key, data); // sans attendre : n'allonge pas l'affichage
    return data;
  } catch (e) {
    if (e instanceof NetworkError) {
      const cached = await readCache<T>(key);
      if (cached) {
        noteCacheServed(cached.savedAt);
        return cached.data;
      }
    }
    throw e;
  }
}
