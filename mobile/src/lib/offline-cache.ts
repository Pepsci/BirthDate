import {
  documentDirectory,
  readAsStringAsync,
  writeAsStringAsync,
  deleteAsync,
  makeDirectoryAsync,
  getInfoAsync,
} from "expo-file-system/legacy";

/**
 * Cache hors ligne : un fichier JSON par clé dans le dossier Documents de
 * l'app (sandbox, invisible des autres apps).
 *
 * Pourquoi des fichiers plutôt que SQLite : quelques centaines de cartes
 * tiennent dans un seul JSON, et expo-file-system est déjà embarqué — pas de
 * nouveau module natif, donc pas de nouveau build de dev ni de TestFlight.
 *
 * ⚠️ Chaque entrée porte l'id de son propriétaire. Sur un téléphone partagé,
 * si un autre compte se connecte, le cache du précédent est ignoré (et vidé
 * au signOut). `setCacheOwner()` est appelé par auth-context.
 *
 * Tout est « best effort » : une lecture ou écriture qui échoue renvoie null
 * ou ne fait rien, sans jamais casser l'écran qui l'appelle.
 */

const DIR = `${documentDirectory}offline-cache/`;

interface CacheEntry<T> {
  userId: string;
  savedAt: number;
  data: T;
}

let owner: string | null = null;

export function setCacheOwner(userId: string | null) {
  owner = userId;
}

function fileFor(key: string): string {
  // Clés du type "dates" ou "date-<id>" : on neutralise tout caractère exotique
  return `${DIR}${key.replace(/[^a-zA-Z0-9_-]/g, "_")}.json`;
}

async function ensureDir() {
  const info = await getInfoAsync(DIR);
  if (!info.exists) await makeDirectoryAsync(DIR, { intermediates: true });
}

export async function writeCache<T>(key: string, data: T): Promise<void> {
  if (!owner) return;
  try {
    await ensureDir();
    const entry: CacheEntry<T> = { userId: owner, savedAt: Date.now(), data };
    await writeAsStringAsync(fileFor(key), JSON.stringify(entry));
  } catch (e) {
    console.warn(`[offline-cache] écriture ${key} impossible`, e);
  }
}

/**
 * @param anyOwner lire sans vérifier le propriétaire — réservé à la lecture
 *                 du profil au démarrage, avant de savoir qui est connecté.
 */
export async function readCache<T>(
  key: string,
  { anyOwner = false } = {},
): Promise<{ data: T; savedAt: number; userId: string } | null> {
  try {
    const info = await getInfoAsync(fileFor(key));
    if (!info.exists) return null;
    const entry = JSON.parse(
      await readAsStringAsync(fileFor(key)),
    ) as CacheEntry<T>;
    if (!anyOwner && entry.userId !== owner) return null;
    return { data: entry.data, savedAt: entry.savedAt, userId: entry.userId };
  } catch {
    return null;
  }
}

/** Vide tout le cache (déconnexion). */
export async function clearCache(): Promise<void> {
  try {
    await deleteAsync(DIR, { idempotent: true });
  } catch (e) {
    console.warn("[offline-cache] suppression impossible", e);
  }
}
