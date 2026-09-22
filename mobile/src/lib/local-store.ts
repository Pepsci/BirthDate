import {
  documentDirectory,
  readAsStringAsync,
  writeAsStringAsync,
  deleteAsync,
  makeDirectoryAsync,
  getInfoAsync,
  moveAsync,
} from "expo-file-system/legacy";
import type { DateEntry } from "./dates";
import type { WishlistItem } from "./wishlist";

/**
 * Données du mode local (sans compte) — docs/MODE_LOCAL.md § 5.1.
 *
 * ⚠️ À NE PAS CONFONDRE avec offline-cache.ts :
 * - le cache est une copie JETABLE de données serveur, vidé au signOut ;
 * - ici, c'est la SEULE copie. Rien ne doit jamais la vider automatiquement
 *   (ni signOut, ni clearCache). Seul `clearLocalData()`, appelé sur action
 *   explicite de l'utilisateur, l'efface.
 *
 * Emplacement : Documents/local-data/ — inclus dans la sauvegarde iCloud /
 * Google de l'appareil, ce qui fait une sauvegarde gratuite.
 *
 * Trois protections, parce qu'il n'y a pas de serveur pour rattraper une
 * erreur :
 * 1. Écriture atomique : on écrit un .tmp, l'ancienne version devient .bak,
 *    le .tmp prend sa place, puis on supprime le .bak. Un plantage à
 *    n'importe quelle étape laisse toujours un fichier complet (principal
 *    ou .bak), relu au démarrage suivant.
 * 2. Écritures en file : deux modifications rapprochées (ex. deux idées de
 *    cadeau ajoutées vite) ne s'écrasent pas, chacune part de la précédente.
 * 3. Un fichier illisible n'est jamais écrasé : il est mis de côté
 *    (`.corrupt-<date>.json`) avant qu'on reparte du .bak ou d'une liste vide.
 *    Un fichier écrit par une version PLUS RÉCENTE de l'app bloque les
 *    écritures au lieu d'être réécrit dans un format plus ancien.
 */

const DIR = `${documentDirectory}local-data/`;
/** Photos des cartes en mode local (utilisé à l'étape 2). */
export const LOCAL_PHOTOS_DIR = `${DIR}photos/`;

/** À incrémenter à chaque changement de format, avec une étape dans migrate(). */
export const LOCAL_SCHEMA_VERSION = 1;

export type LocalCollection = "dates" | "wishlist" | "prefs";

/**
 * Carte telle qu'enregistrée dans dates.json.
 *
 * `photoFile` = NOM du fichier dans LOCAL_PHOTOS_DIR, jamais le chemin
 * complet : sur iOS, le chemin du dossier Documents change à chaque mise à
 * jour ou restauration de l'app. Un chemin absolu enregistré pointerait
 * alors dans le vide. Le chemin complet (`photo`) est recalculé à la lecture.
 */
export type LocalDate = Omit<DateEntry, "photo"> & {
  photoFile?: string | null;
  createdAt?: number;
  /**
   * Import vers un compte (étape 6, local-migration.ts) : marques posées au
   * fur et à mesure, pour qu'un import relancé après un échec reprenne là
   * où il s'était arrêté — sans jamais recréer ce qui est déjà passé.
   */
  importedAs?: string; // id de la carte côté serveur
  importedGifts?: string[]; // ids LOCAUX des idées déjà envoyées
  photoImported?: boolean;
  importDone?: boolean;
};

export type LocalWishlistItem = WishlistItem & {
  createdAt?: number;
  importedAs?: string; // id côté serveur (étape 6)
};

/**
 * Réglages d'affichage du mode local (en ligne, ils vivent sur le serveur,
 * dans le profil). Un seul élément dans prefs.json, `_id: "prefs"`.
 */
export interface LocalPrefs {
  _id: "prefs";
  hideNamedaysOnCards?: boolean;
  showTodayNamedayOnHome?: boolean;
  /** Rappels locaux (étape 4) — activés par défaut. */
  remindersEnabled?: boolean;
  /** Dernière sauvegarde exportée (timestamp) — rappel de sauvegarde. */
  lastBackupAt?: number;
}

interface CollectionTypes {
  dates: LocalDate;
  wishlist: LocalWishlistItem;
  prefs: LocalPrefs;
}

interface LocalFile<T> {
  schemaVersion: number;
  updatedAt: number;
  items: T[];
}

export class LocalStoreError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LocalStoreError";
  }
}

// ---- Ids locaux ----

/** `local-<timestamp>-<aléa>` — distinct des `tmp-…` de la file hors ligne. */
export function newLocalId(): string {
  const rand = Math.random().toString(36).slice(2, 8).padEnd(6, "0");
  return `local-${Date.now()}-${rand}`;
}

export function isLocalId(id: string | null | undefined): boolean {
  return typeof id === "string" && id.startsWith("local-");
}

// ---- Fichiers ----

const fileFor = (c: LocalCollection) => `${DIR}${c}.json`;

async function exists(path: string): Promise<boolean> {
  return (await getInfoAsync(path)).exists;
}

async function ensureDir() {
  if (!(await exists(DIR))) await makeDirectoryAsync(DIR, { intermediates: true });
}

async function writeFileAtomic(path: string, content: string): Promise<void> {
  const tmp = `${path}.tmp`;
  const bak = `${path}.bak`;
  await writeAsStringAsync(tmp, content);
  if (await exists(path)) {
    await deleteAsync(bak, { idempotent: true });
    await moveAsync({ from: path, to: bak });
  }
  await moveAsync({ from: tmp, to: path });
  await deleteAsync(bak, { idempotent: true });
}

/** Met un fichier illisible de côté, pour pouvoir le récupérer à la main. */
async function quarantine(path: string, c: LocalCollection) {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const to = `${DIR}${c}.corrupt-${stamp}.json`;
  try {
    await moveAsync({ from: path, to });
    console.warn(`[local-store] fichier illisible mis de côté : ${to}`);
  } catch (e) {
    console.warn("[local-store] mise de côté impossible", e);
  }
}

/**
 * Transforme le contenu brut d'un fichier en liste à jour.
 * Lève `LocalStoreError` si le fichier vient d'une version plus récente, et
 * une erreur quelconque si le format est cassé (→ mise de côté).
 */
function migrate<T>(raw: unknown): T[] {
  const file = raw as Partial<LocalFile<T>>;
  if (!file || typeof file !== "object" || !Array.isArray(file.items)) {
    throw new Error("format inattendu");
  }
  const version = typeof file.schemaVersion === "number" ? file.schemaVersion : 0;
  if (version > LOCAL_SCHEMA_VERSION) {
    throw new LocalStoreError(
      "Tes données ont été enregistrées par une version plus récente de " +
        "BirthReminder. Mets l'app à jour pour y accéder.",
    );
  }
  // Pas encore de migration : la v1 est la première version.
  // Futur : if (version < 2) items = items.map(...)
  return file.items;
}

async function parseFile<T>(path: string): Promise<T[]> {
  return migrate<T>(JSON.parse(await readAsStringAsync(path)));
}

async function loadFromDisk<T>(c: LocalCollection): Promise<T[]> {
  const main = fileFor(c);
  const bak = `${main}.bak`;

  if (await exists(main)) {
    try {
      return await parseFile<T>(main);
    } catch (e) {
      if (e instanceof LocalStoreError) throw e; // version plus récente : on ne touche à rien
      await quarantine(main, c);
    }
  }
  // Principal absent ou illisible : plantage entre deux étapes d'écriture ?
  if (await exists(bak)) {
    try {
      const items = await parseFile<T>(bak);
      await moveAsync({ from: bak, to: main }); // le .bak redevient le principal
      return items;
    } catch (e) {
      if (e instanceof LocalStoreError) throw e;
      await quarantine(bak, c);
    }
  }
  return [];
}

// ---- Mémoire + file d'écriture ----

/** Copie en mémoire, identique au disque (mise à jour APRÈS écriture réussie). */
// Typée large ici ; ensureLoaded() la restitue avec le bon type.
const memory: Partial<Record<LocalCollection, unknown[]>> = {};

const chains: Record<LocalCollection, Promise<unknown>> = {
  dates: Promise.resolve(),
  wishlist: Promise.resolve(),
  prefs: Promise.resolve(),
};

/** Exécute les tâches d'une collection une par une, dans l'ordre d'appel. */
function serialize<T>(c: LocalCollection, task: () => Promise<T>): Promise<T> {
  const run = chains[c].then(task, task);
  chains[c] = run.catch(() => undefined);
  return run;
}

// Copie profonde : un écran qui modifie l'objet reçu ne doit pas modifier
// la mémoire en douce (elle ne correspondrait plus au disque).
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));

async function ensureLoaded<K extends LocalCollection>(
  c: K,
): Promise<CollectionTypes[K][]> {
  let items = memory[c] as CollectionTypes[K][] | undefined;
  if (!items) {
    items = await loadFromDisk<CollectionTypes[K]>(c);
    memory[c] = items;
  }
  return items;
}

// ---- Écoute des modifications ----
// Les rappels locaux (local-reminders.ts) se reprogramment après chaque
// modification d'une carte ou d'un réglage, sans que les écrans aient à y
// penser.

type ChangeListener = (c: LocalCollection) => void;
const listeners = new Set<ChangeListener>();

export function onLocalChange(fn: ChangeListener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

function emitChange(c: LocalCollection) {
  for (const fn of listeners) {
    try {
      fn(c);
    } catch (e) {
      console.warn("[local-store] écouteur en erreur", e);
    }
  }
}

// ---- API publique ----

/** Lit toute une collection (copie). */
export function readLocal<K extends LocalCollection>(
  c: K,
): Promise<CollectionTypes[K][]> {
  return serialize(c, async () => clone(await ensureLoaded(c)));
}

/**
 * Modifie une collection : `fn` reçoit une copie de la liste et renvoie la
 * nouvelle. L'écriture est atomique et passe après les précédentes.
 * Renvoie la liste enregistrée.
 */
export function updateLocal<K extends LocalCollection>(
  c: K,
  fn: (items: CollectionTypes[K][]) => CollectionTypes[K][],
): Promise<CollectionTypes[K][]> {
  return serialize(c, async () => {
    const next = fn(clone(await ensureLoaded(c)));
    const file: LocalFile<CollectionTypes[K]> = {
      schemaVersion: LOCAL_SCHEMA_VERSION,
      updatedAt: Date.now(),
      items: next,
    };
    await ensureDir();
    await writeFileAtomic(fileFor(c), JSON.stringify(file));
    memory[c] = next;
    emitChange(c);
    return clone(next);
  });
}

/** Nombre de cartes locales (import vers un compte, rappel de sauvegarde). */
export async function countLocalDates(): Promise<number> {
  return (await readLocal("dates")).length;
}

/**
 * Efface TOUTES les données locales (cartes, liste d'envies, photos).
 * Irréversible — uniquement sur action explicite de l'utilisateur
 * (« Effacer toutes mes données », ou après un import réussi vers un compte).
 */
export function clearLocalData(): Promise<void> {
  // On attend les écritures en cours de chaque collection avant d'effacer
  return serialize("dates", () =>
    serialize("wishlist", () =>
      serialize("prefs", async () => {
        await deleteAsync(DIR, { idempotent: true });
        delete memory.dates;
        delete memory.wishlist;
        delete memory.prefs;
      }),
    ),
  );
}

/** Chemin du dossier, pour l'écran de test en dev uniquement. */
export const __LOCAL_DATA_DIR = DIR;

/**
 * DEV UNIQUEMENT : oublie la copie en mémoire pour forcer une vraie relecture
 * du disque (simule un redémarrage de l'app). Utilisé par app/dev/local-store.
 */
export function __forgetLocalMemory(): void {
  if (!__DEV__) return;
  delete memory.dates;
  delete memory.wishlist;
  delete memory.prefs;
}
