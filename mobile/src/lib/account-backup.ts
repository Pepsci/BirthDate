import {
  cacheDirectory,
  deleteAsync,
  downloadAsync,
  makeDirectoryAsync,
  readAsStringAsync,
  writeAsStringAsync,
  EncodingType,
} from "expo-file-system/legacy";
import { api, NetworkError } from "./api";
import { updateDatePhoto, type DateEntry } from "./dates";
import { dayKey, giftKey, wishKey } from "./local-migration";
import type { WishlistItem } from "./wishlist";
import { LOCAL_SCHEMA_VERSION } from "./local-store";
import { BACKUP_KIND, type LocalBackup } from "./local-backup";

/**
 * Sauvegarde des données d'un COMPTE, au même format que la sauvegarde du
 * mode local (lib/local-backup.ts).
 *
 * ── Pourquoi le même format ────────────────────────────────────────────────
 * Un seul fichier, un seul lecteur : une sauvegarde faite sans compte se
 * restaure dans un compte, et l'inverse. Ça évite un second format à faire
 * évoluer, et ça rend la bascule entre les deux modes indolore.
 *
 * ── Ce qui est sauvegardé ──────────────────────────────────────────────────
 * Les cartes d'anniversaire créées à la main (avec leurs idées cadeaux, leurs
 * réglages de rappel et leur photo) et la wishlist personnelle.
 *
 * Volontairement EXCLUS :
 * - les cartes liées à un ami inscrit (`linkedUser`) : elles découlent de
 *   l'amitié, le serveur les recrée tout seul. Les restaurer fabriquerait des
 *   cartes manuelles en double à côté des vraies ;
 * - les événements, cagnottes et listes communes : ce sont des objets
 *   PARTAGÉS. Les restaurer créerait des doublons chez les autres
 *   participants, qui n'ont rien demandé.
 */

const EXPORT_DIR = `${cacheDirectory}account-backup/`;
const PHOTO_TMP = `${cacheDirectory}account-backup-photo.tmp`;

export interface BackupProgress {
  done: number;
  total: number;
  current?: string;
}

/**
 * Télécharge une photo de carte et la renvoie en base64.
 *
 * Renvoie null en cas d'échec : une photo manquante ne doit jamais faire
 * échouer une sauvegarde — perdre la photo est gênant, perdre les 80 cartes
 * le serait bien plus.
 */
async function photoToBase64(url: string): Promise<string | null> {
  try {
    await deleteAsync(PHOTO_TMP, { idempotent: true });
    const res = await downloadAsync(url, PHOTO_TMP);
    if (res.status !== 200) return null;
    const b64 = await readAsStringAsync(PHOTO_TMP, {
      encoding: EncodingType.Base64,
    });
    await deleteAsync(PHOTO_TMP, { idempotent: true });
    return b64;
  } catch {
    return null;
  }
}

/** Construit la sauvegarde à partir des données du serveur. */
export async function buildAccountBackup(
  onProgress?: (p: BackupProgress) => void,
): Promise<LocalBackup> {
  const [allDates, wishlistRes] = await Promise.all([
    api<DateEntry[]>("/date"),
    api<{ data: WishlistItem[] }>("/wishlist"),
  ]);

  const dates = allDates.filter((d) => !d.linkedUser);
  const wishlist = wishlistRes.data ?? [];
  const total = dates.length + 1;
  let done = 0;

  const backupDates: LocalBackup["dates"] = [];
  for (const d of dates) {
    onProgress?.({ done, total, current: d.name });
    const { photo, ...rest } = d;
    backupDates.push({
      ...rest,
      photoFile: null,
      photoBase64: photo ? await photoToBase64(photo) : null,
    });
    done++;
  }
  onProgress?.({ done, total });

  return {
    kind: BACKUP_KIND,
    schemaVersion: LOCAL_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    dates: backupDates,
    wishlist,
    prefs: null,
  };
}

/**
 * Écrit la sauvegarde dans le cache et renvoie son chemin.
 *
 * Le cache, et pas Documents : le fichier part aussitôt dans la feuille de
 * partage (Drive, Fichiers, mail…), il n'a pas à être sauvegardé une seconde
 * fois par iCloud ni à peser dans le stockage de l'app.
 */
export async function writeAccountBackupFile(
  onProgress?: (p: BackupProgress) => void,
): Promise<string> {
  const backup = await buildAccountBackup(onProgress);
  await deleteAsync(EXPORT_DIR, { idempotent: true });
  await makeDirectoryAsync(EXPORT_DIR, { intermediates: true });
  const stamp = new Date().toISOString().slice(0, 10);
  const uri = `${EXPORT_DIR}birthreminder-sauvegarde-${stamp}.json`;
  await writeAsStringAsync(uri, JSON.stringify(backup));
  return uri;
}

// ── Restauration ────────────────────────────────────────────────────────────

/**
 * Restaure une sauvegarde DANS un compte.
 *
 * Mêmes règles de rapprochement que l'import du mode local
 * (lib/local-migration.ts), et c'est important : une carte déjà présente
 * (même prénom, même nom, même jour de naissance) n'est jamais recréée, ses
 * idées de cadeaux manquantes y sont ajoutées, et sa photo n'est posée que
 * si elle n'en a pas. Restaurer deux fois la même sauvegarde ne crée donc
 * aucun doublon — c'est la garantie qui rend le bouton sans danger.
 *
 * Rien n'est supprimé : la restauration AJOUTE à ce qui existe. Elle ne
 * remet pas le compte dans l'état exact de la sauvegarde, elle rapatrie ce
 * qui manque.
 */
export interface RestoreResult {
  cards: number; // cartes créées
  merged: number; // cartes déjà présentes, complétées
  wishlist: number; // envies créées
  failures: string[]; // ce qui n'est pas passé
  offline: boolean; // arrêté faute de réseau
}

const RESTORE_TMP = `${cacheDirectory}account-restore-photo.jpg`;

/** Écrit une photo base64 dans le cache et renvoie son URI, ou null. */
async function base64ToFile(b64: string): Promise<string | null> {
  try {
    await deleteAsync(RESTORE_TMP, { idempotent: true });
    await writeAsStringAsync(RESTORE_TMP, b64, {
      encoding: EncodingType.Base64,
    });
    return RESTORE_TMP;
  } catch {
    return null;
  }
}

export async function restoreBackupIntoAccount(
  backup: LocalBackup,
  onProgress?: (p: BackupProgress) => void,
): Promise<RestoreResult> {
  const result: RestoreResult = {
    cards: 0,
    merged: 0,
    wishlist: 0,
    failures: [],
    offline: false,
  };

  // État actuel du compte : c'est lui qui décide de créer ou de compléter.
  let serverDates: DateEntry[];
  let serverWishlist: WishlistItem[];
  try {
    const [d, w] = await Promise.all([
      api<DateEntry[]>("/date"),
      api<{ data: WishlistItem[] }>("/wishlist"),
    ]);
    serverDates = d;
    serverWishlist = w.data ?? [];
  } catch (e) {
    if (e instanceof NetworkError) return { ...result, offline: true };
    throw e;
  }
  const serverByKey = new Map(
    serverDates.filter((d) => !d.linkedUser).map((d) => [dayKey(d), d]),
  );

  const total = backup.dates.length + backup.wishlist.length;
  let done = 0;

  for (const card of backup.dates) {
    onProgress?.({ done, total, current: card.name });
    try {
      const existing = serverByKey.get(dayKey(card));
      let serverId = existing?._id;

      if (!serverId) {
        const created = await api<DateEntry>("/date", {
          method: "POST",
          body: JSON.stringify({
            name: card.name,
            surname: card.surname ?? "",
            date: card.date,
            family: !!card.family,
            nameday: card.nameday || undefined,
          }),
        });
        serverId = created._id;
        result.cards++;

        // Réglages de rappel : uniquement sur une carte créée. Ceux d'une
        // carte déjà dans le compte sont plus récents que la sauvegarde.
        if (card.notificationPreferences) {
          await api(`/date/${serverId}/notification-preferences`, {
            method: "PUT",
            body: JSON.stringify(card.notificationPreferences),
          });
        }
        if (card.namedayPreferences) {
          await api(`/date/${serverId}/nameday-preferences`, {
            method: "PUT",
            body: JSON.stringify(card.namedayPreferences),
          });
        }
        if (card.receiveNotifications === false) {
          await api(`/date/${serverId}/notifications`, {
            method: "PUT",
            body: JSON.stringify({ receiveNotifications: false }),
          });
        }
      } else {
        result.merged++;
      }

      // Idées de cadeaux : seulement celles qui manquent.
      const already = new Set((existing?.gifts ?? []).map(giftKey));
      for (const g of card.gifts ?? []) {
        if (already.has(giftKey(g))) continue;
        await api(`/date/${serverId}/gifts`, {
          method: "PATCH",
          body: JSON.stringify({
            giftName: g.giftName,
            occasion: g.occasion,
            year: g.year,
            purchased: g.purchased,
            status: g.status,
            url: g.url ?? undefined,
            price: g.price ?? undefined,
            image: g.image ?? undefined,
          }),
        });
        already.add(giftKey(g));
      }

      // Photo : jamais par-dessus une photo existante.
      if (card.photoBase64 && !existing?.photo) {
        const uri = await base64ToFile(card.photoBase64);
        if (uri) await updateDatePhoto(serverId!, uri);
      }
    } catch (e) {
      result.failures.push(
        `${card.name}${card.surname ? " " + card.surname : ""}`.trim(),
      );
      if (e instanceof NetworkError) {
        result.offline = true;
        break; // inutile d'insister sans réseau
      }
    }
    done++;
  }

  if (!result.offline) {
    const serverWishKeys = new Set(serverWishlist.map(wishKey));
    for (const w of backup.wishlist) {
      onProgress?.({ done, total, current: w.title });
      try {
        if (!serverWishKeys.has(wishKey(w))) {
          await api("/wishlist", {
            method: "POST",
            body: JSON.stringify({
              title: w.title,
              description: w.description ?? undefined,
              price: w.price ?? undefined,
              url: w.url ?? undefined,
              image: w.image ?? undefined,
              isShared: w.isShared !== false,
            }),
          });
          serverWishKeys.add(wishKey(w));
          result.wishlist++;
        }
      } catch (e) {
        result.failures.push(w.title);
        if (e instanceof NetworkError) {
          result.offline = true;
          break;
        }
      }
      done++;
    }
  }

  onProgress?.({ done, total });
  await deleteAsync(RESTORE_TMP, { idempotent: true }).catch(() => {});
  return result;
}
