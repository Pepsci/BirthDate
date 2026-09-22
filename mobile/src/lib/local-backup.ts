import {
  cacheDirectory,
  deleteAsync,
  getInfoAsync,
  makeDirectoryAsync,
  readAsStringAsync,
  readDirectoryAsync,
  writeAsStringAsync,
  EncodingType,
} from "expo-file-system/legacy";
import type * as DocumentPickerTypes from "expo-document-picker";
import {
  LOCAL_PHOTOS_DIR,
  LOCAL_SCHEMA_VERSION,
  LocalDate,
  LocalPrefs,
  LocalWishlistItem,
  newLocalId,
  readLocal,
  updateLocal,
} from "./local-store";

/**
 * Sauvegarde / restauration du mode local — docs/MODE_LOCAL.md § 5.5.
 *
 * Sans compte, c'est la SEULE vraie sauvegarde : si le téléphone est perdu
 * ou l'app supprimée, tout disparaît. Le même format servira à l'import
 * vers un compte (étape 6).
 *
 * Un seul fichier JSON, photos comprises (en base64) : c'est ce qui permet
 * de tenir le critère « désinstaller, réinstaller, restaurer = mêmes cartes ».
 */

export const BACKUP_KIND = "birthreminder-local-backup";

type BackupDate = LocalDate & {
  /** Photo en base64 (JPEG), à la place du nom de fichier local. */
  photoBase64?: string | null;
};

export interface LocalBackup {
  kind: typeof BACKUP_KIND;
  schemaVersion: number;
  exportedAt: string;
  dates: BackupDate[];
  wishlist: LocalWishlistItem[];
  prefs: Omit<LocalPrefs, "lastBackupAt"> | null;
}

export interface BackupSummary {
  dates: number;
  wishlist: number;
  photos: number;
  exportedAt: Date | null;
}

export class BackupFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BackupFormatError";
  }
}

// ---- Sélecteur de fichier, chargé paresseusement ----
// Module natif ajouté le 22/09/26 : un client de dev plus ancien ne l'a pas.
// Un import statique ferait planter tout l'écran (même piège que
// lib/calendar.ts) ; ici, le bouton d'import est simplement masqué.

let picker: typeof DocumentPickerTypes | null | undefined;

function getPicker(): typeof DocumentPickerTypes | null {
  if (picker !== undefined) return picker;
  try {
    picker = require("expo-document-picker") as typeof DocumentPickerTypes;
  } catch {
    picker = null;
  }
  return picker;
}

export function isImportAvailable(): boolean {
  return getPicker() !== null;
}

// ---- Export ----

const EXPORT_DIR = `${cacheDirectory}backup-export/`;

async function readPhoto(file: string): Promise<string | null> {
  try {
    return await readAsStringAsync(`${LOCAL_PHOTOS_DIR}${file}`, {
      encoding: EncodingType.Base64,
    });
  } catch {
    return null; // photo manquante : la carte est exportée sans
  }
}

export async function buildBackup(): Promise<LocalBackup> {
  const [dates, wishlist, prefsList] = await Promise.all([
    readLocal("dates"),
    readLocal("wishlist"),
    readLocal("prefs"),
  ]);
  const withPhotos: BackupDate[] = [];
  for (const d of dates) {
    const { photoFile, ...rest } = d;
    withPhotos.push({
      ...rest,
      photoFile: null,
      photoBase64: photoFile ? await readPhoto(photoFile) : null,
    });
  }
  const prefs = prefsList[0];
  let exportedPrefs: LocalBackup["prefs"] = null;
  if (prefs) {
    const { lastBackupAt: _ignored, ...keep } = prefs;
    exportedPrefs = keep;
  }
  return {
    kind: BACKUP_KIND,
    schemaVersion: LOCAL_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    dates: withPhotos,
    wishlist,
    prefs: exportedPrefs,
  };
}

/**
 * Écrit la sauvegarde dans le cache (pas dans Documents : inutile de la
 * faire sauvegarder une seconde fois par iCloud) et renvoie son chemin.
 * Les exports précédents sont supprimés.
 */
export async function writeBackupFile(): Promise<string> {
  const backup = await buildBackup();
  await deleteAsync(EXPORT_DIR, { idempotent: true });
  await makeDirectoryAsync(EXPORT_DIR, { intermediates: true });
  const stamp = new Date().toISOString().slice(0, 10);
  const uri = `${EXPORT_DIR}birthreminder-sauvegarde-${stamp}.json`;
  await writeAsStringAsync(uri, JSON.stringify(backup));
  return uri;
}

/** À appeler une fois le fichier réellement partagé. */
export async function markBackupDone(): Promise<void> {
  await updateLocal("prefs", (items) => [
    { ...(items[0] ?? { _id: "prefs" as const }), lastBackupAt: Date.now() },
  ]);
}

export async function getLastBackupAt(): Promise<number | null> {
  return (await readLocal("prefs"))[0]?.lastBackupAt ?? null;
}

// ---- Import ----

/**
 * Ouvre le sélecteur de fichiers et lit la sauvegarde choisie.
 * Renvoie null si l'utilisateur annule.
 */
export async function pickBackupFile(): Promise<LocalBackup | null> {
  const DocumentPicker = getPicker();
  if (!DocumentPicker) {
    throw new BackupFormatError(
      "L'import n'est pas disponible dans cette version de l'app.",
    );
  }
  // Tous types : un fichier reçu par mail ou AirDrop n'a pas toujours le
  // type JSON. Le contenu est vérifié juste après.
  const res = await DocumentPicker.getDocumentAsync({
    type: "*/*",
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (res.canceled || !res.assets?.[0]) return null;
  const uri = res.assets[0].uri;
  try {
    return parseBackup(await readAsStringAsync(uri));
  } finally {
    deleteAsync(uri, { idempotent: true }).catch(() => {});
  }
}

/** Vérifie le format : on refuse plutôt que d'importer à moitié. */
export function parseBackup(text: string): LocalBackup {
  let raw: any;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new BackupFormatError("Ce fichier n'est pas une sauvegarde BirthReminder.");
  }
  if (!raw || raw.kind !== BACKUP_KIND || !Array.isArray(raw.dates)) {
    throw new BackupFormatError("Ce fichier n'est pas une sauvegarde BirthReminder.");
  }
  if (typeof raw.schemaVersion !== "number" || raw.schemaVersion > LOCAL_SCHEMA_VERSION) {
    throw new BackupFormatError(
      "Cette sauvegarde vient d'une version plus récente de BirthReminder. " +
        "Mets l'app à jour pour l'importer.",
    );
  }
  const badDate = raw.dates.find(
    (d: any) =>
      !d || typeof d.name !== "string" || !d.name.trim() ||
      typeof d.date !== "string" || isNaN(new Date(d.date).getTime()),
  );
  if (badDate) {
    throw new BackupFormatError("La sauvegarde est abîmée : une carte est illisible.");
  }
  return {
    kind: BACKUP_KIND,
    schemaVersion: raw.schemaVersion,
    exportedAt: typeof raw.exportedAt === "string" ? raw.exportedAt : "",
    dates: raw.dates,
    wishlist: Array.isArray(raw.wishlist)
      ? raw.wishlist.filter((w: any) => w && typeof w.title === "string")
      : [],
    prefs: raw.prefs && typeof raw.prefs === "object" ? raw.prefs : null,
  };
}

export function summarize(b: LocalBackup): BackupSummary {
  const at = b.exportedAt ? new Date(b.exportedAt) : null;
  return {
    dates: b.dates.length,
    wishlist: b.wishlist.length,
    photos: b.dates.filter((d) => d.photoBase64).length,
    exportedAt: at && !isNaN(at.getTime()) ? at : null,
  };
}

/** Clé de doublon : même prénom, même nom, même jour de naissance. */
function dateKey(d: { name: string; surname?: string; date: string }): string {
  const b = new Date(d.date);
  const day = `${b.getFullYear()}-${b.getMonth()}-${b.getDate()}`;
  return `${d.name.trim().toLowerCase()}|${(d.surname ?? "").trim().toLowerCase()}|${day}`;
}

const wishKey = (w: LocalWishlistItem) =>
  `${w.title.trim().toLowerCase()}|${(w.url ?? "").trim()}`;

async function ensurePhotosDir() {
  if (!(await getInfoAsync(LOCAL_PHOTOS_DIR)).exists) {
    await makeDirectoryAsync(LOCAL_PHOTOS_DIR, { intermediates: true });
  }
}

/** Nettoie une carte venue d'un fichier : jamais de lien serveur. */
function toLocalDate(d: BackupDate, id: string, photoFile: string | null): LocalDate {
  const { photoBase64: _p, ...rest } = d;
  return {
    ...rest,
    _id: id,
    linkedUser: null,
    sharedGiftList: null,
    conversationId: undefined,
    pending: undefined,
    family: !!d.family,
    gifts: Array.isArray(d.gifts) ? d.gifts : [],
    photoFile,
  };
}

export interface ImportResult {
  added: number;
  skipped: number;
  wishlistAdded: number;
}

/**
 * Applique une sauvegarde.
 * - "replace" : les données actuelles sont remplacées par celles du fichier ;
 * - "merge"   : on ajoute ce qui manque (doublon = même prénom, nom et date ;
 *               envie en double = même titre et même lien).
 *
 * Ordre choisi pour ne jamais perdre de données : les photos du fichier sont
 * écrites AVANT la liste des cartes, et les anciennes photos ne sont
 * supprimées qu'APRÈS (remplacement). Un plantage au milieu laisse au pire
 * des photos en trop, jamais une carte sans sa photo.
 */
export async function applyBackup(
  backup: LocalBackup,
  mode: "replace" | "merge",
): Promise<ImportResult> {
  const current = await readLocal("dates");
  const existingKeys = new Set(mode === "merge" ? current.map(dateKey) : []);
  const usedIds = new Set(mode === "merge" ? current.map((d) => d._id) : []);

  await ensurePhotosDir();
  const incoming: LocalDate[] = [];
  let skipped = 0;
  for (const d of backup.dates) {
    const key = dateKey(d);
    if (existingKeys.has(key)) {
      skipped++;
      continue;
    }
    existingKeys.add(key); // doublons à l'intérieur du fichier lui-même
    const id = d._id && !usedIds.has(d._id) ? d._id : newLocalId();
    usedIds.add(id);
    let photoFile: string | null = null;
    if (d.photoBase64) {
      photoFile = `${id}-${Date.now()}.jpg`;
      try {
        await writeAsStringAsync(`${LOCAL_PHOTOS_DIR}${photoFile}`, d.photoBase64, {
          encoding: EncodingType.Base64,
        });
      } catch {
        photoFile = null; // photo illisible : la carte est importée sans
      }
    }
    incoming.push(toLocalDate(d, id, photoFile));
  }

  const oldPhotos = mode === "replace"
    ? current.map((d) => d.photoFile).filter((f): f is string => !!f)
    : [];

  await updateLocal("dates", (items) =>
    mode === "replace" ? incoming : [...items, ...incoming],
  );

  // Liste d'envies
  let wishlistAdded = 0;
  await updateLocal("wishlist", (items) => {
    const base = mode === "replace" ? [] : items;
    const keys = new Set(base.map(wishKey));
    const ids = new Set(base.map((w) => w._id));
    const added: LocalWishlistItem[] = [];
    for (const w of backup.wishlist) {
      if (keys.has(wishKey(w))) continue;
      keys.add(wishKey(w));
      const id = w._id && !ids.has(w._id) ? w._id : newLocalId();
      ids.add(id);
      added.push({ ...w, _id: id, reservedBy: null, reservedByGuest: null });
    }
    wishlistAdded = added.length;
    return [...base, ...added];
  });

  // Réglages : repris du fichier en remplacement seulement
  if (mode === "replace" && backup.prefs) {
    await updateLocal("prefs", (items) => [
      { ...backup.prefs, _id: "prefs", lastBackupAt: items[0]?.lastBackupAt },
    ]);
  }

  // Photos devenues orphelines (remplacement uniquement)
  if (oldPhotos.length > 0) {
    const kept = new Set(incoming.map((d) => d.photoFile));
    for (const f of oldPhotos) {
      if (!kept.has(f)) {
        await deleteAsync(`${LOCAL_PHOTOS_DIR}${f}`, { idempotent: true }).catch(() => {});
      }
    }
  }

  return { added: incoming.length, skipped, wishlistAdded };
}

/** Nombre de photos présentes (écran Mes données). */
export async function countLocalPhotos(): Promise<number> {
  try {
    if (!(await getInfoAsync(LOCAL_PHOTOS_DIR)).exists) return 0;
    return (await readDirectoryAsync(LOCAL_PHOTOS_DIR)).length;
  } catch {
    return 0;
  }
}
