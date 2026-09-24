import { api, NetworkError } from "./api";
import type { DateEntry } from "./dates";
import { updateDatePhoto } from "./dates";
import type { WishlistItem } from "./wishlist";
import { updateMe } from "./users";
import {
  clearLocalData,
  LOCAL_PHOTOS_DIR,
  LocalDate,
  readLocal,
  updateLocal,
} from "./local-store";

/**
 * Passage du mode local vers un compte — docs/MODE_LOCAL.md § 3.3.
 *
 * Appelé APRÈS la connexion (mode déjà « compte ») : les appels passent donc
 * par api() normalement. Les données locales, elles, restent sur le disque
 * tant que l'import n'est pas entièrement confirmé par le serveur.
 *
 * Trois garanties :
 * 1. REJOUABLE SANS DOUBLON : chaque carte locale reçoit des marques
 *    (`importedAs`, `importedGifts`, `photoImported`, `importDone`),
 *    enregistrées dès que le serveur a confirmé l'étape. Relancer l'import
 *    reprend exactement là où il s'était arrêté.
 * 2. COMPTE DÉJÀ REMPLI : une carte déjà présente dans le compte (même
 *    prénom, nom et jour) n'est pas recréée ; ses idées de cadeaux y sont
 *    ajoutées (sauf celles déjà présentes), la photo seulement s'il n'en a
 *    pas, et les réglages de rappel du compte sont conservés.
 * 3. RIEN N'EST EFFACÉ avant que TOUT soit passé. En cas d'échec partiel,
 *    les données locales restent et l'écran dit ce qui n'est pas passé.
 *
 * ⚠️ Limite connue (la même que la file hors ligne) : si le serveur crée une
 * carte mais que sa réponse se perd, la marque n'est pas posée et la carte
 * sera recréée au prochain essai. La fusion des doublons (web) rattrape.
 *
 * On appelle api() directement, et non createDate() : en cas de coupure,
 * createDate() mettrait l'opération en file d'attente et répondrait « OK »
 * avec un id provisoire — l'import croirait avoir réussi.
 */

export interface ImportProgress {
  done: number;
  total: number;
  current?: string;
}

export interface MigrationResult {
  cards: number; // cartes créées dans le compte
  merged: number; // cartes déjà présentes, complétées
  wishlist: number;
  failures: string[]; // prénoms (ou titres) qui n'ont pas pu passer
  offline: boolean; // arrêté faute de réseau
  cleared: boolean; // tout est passé : données locales effacées
}

/** Y a-t-il quelque chose à importer ? */
export async function countLocalDataToImport(): Promise<{ dates: number; wishlist: number }> {
  const [dates, wishlist] = await Promise.all([readLocal("dates"), readLocal("wishlist")]);
  return {
    dates: dates.filter((d) => !d.importDone).length,
    wishlist: wishlist.filter((w) => !w.importedAs).length,
  };
}

export async function hasLocalDataToImport(): Promise<boolean> {
  const c = await countLocalDataToImport();
  return c.dates + c.wishlist > 0;
}

/** Enregistre une marque d'import sur une carte locale. */
async function markDate(id: string, patch: Partial<LocalDate>): Promise<void> {
  await updateLocal("dates", (items) =>
    items.map((d) => (d._id === id ? { ...d, ...patch } : d)),
  );
}

export function dayKey(d: { name: string; surname?: string; date: string }): string {
  const b = new Date(d.date);
  return `${d.name.trim().toLowerCase()}|${(d.surname ?? "").trim().toLowerCase()}|${b.getFullYear()}-${b.getMonth()}-${b.getDate()}`;
}

export const giftKey = (g: { giftName: string; year?: number }) =>
  `${g.giftName.trim().toLowerCase()}|${g.year ?? ""}`;

export const wishKey = (w: { title: string; url?: string | null }) =>
  `${w.title.trim().toLowerCase()}|${(w.url ?? "").trim()}`;

/** Importe UNE carte. Lève en cas d'échec (la carte reste à refaire). */
async function importDate(
  local: LocalDate,
  serverByKey: Map<string, DateEntry>,
): Promise<"created" | "merged"> {
  let serverId = local.importedAs;
  // Carte du compte au même prénom / nom / jour. Lors d'une reprise, ce peut
  // être celle que CET import a créée la dernière fois : on s'en sert alors
  // pour ne pas renvoyer les idées de cadeaux déjà passées.
  const existing = serverByKey.get(dayKey(local));
  const serverCard =
    existing && (!serverId || existing._id === serverId) ? existing : undefined;
  const merged = !local.importedAs && !!existing;

  // 1. La carte elle-même
  if (!serverId) {
    if (serverCard) {
      serverId = serverCard._id; // déjà dans le compte : on la complète
    } else {
      const created = await api<DateEntry>("/date", {
        method: "POST",
        body: JSON.stringify({
          name: local.name,
          surname: local.surname ?? "",
          date: local.date,
          family: !!local.family,
          nameday: local.nameday || undefined,
        }),
      });
      serverId = created._id;
      // Fête retirée volontairement en local : le serveur l'aurait recalculée
      if (!local.nameday && created.nameday) {
        await api(`/date/${serverId}`, {
          method: "PATCH",
          body: JSON.stringify({
            name: local.name,
            surname: local.surname ?? "",
            date: local.date,
            family: !!local.family,
            nameday: null,
          }),
        });
      }
      // Réglages de rappel : seulement sur une carte créée (ceux d'une carte
      // déjà dans le compte sont conservés)
      if (local.notificationPreferences) {
        await api(`/date/${serverId}/notification-preferences`, {
          method: "PUT",
          body: JSON.stringify(local.notificationPreferences),
        });
      }
      if (local.namedayPreferences) {
        await api(`/date/${serverId}/nameday-preferences`, {
          method: "PUT",
          body: JSON.stringify(local.namedayPreferences),
        });
      }
      if (local.receiveNotifications === false) {
        await api(`/date/${serverId}/notifications`, {
          method: "PUT",
          body: JSON.stringify({ receiveNotifications: false }),
        });
      }
    }
    await markDate(local._id, { importedAs: serverId });
  }

  // 2. Idées de cadeaux, une par une (marquées au fur et à mesure)
  const already = new Set(local.importedGifts ?? []);
  const existingGifts = new Set((serverCard?.gifts ?? []).map(giftKey));
  for (const g of local.gifts ?? []) {
    if (already.has(g._id)) continue;
    if (!existingGifts.has(giftKey(g))) {
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
    }
    already.add(g._id);
    await markDate(local._id, { importedGifts: [...already] });
  }

  // 3. Photo (pas si la carte du compte en a déjà une)
  if (local.photoFile && !local.photoImported && !serverCard?.photo) {
    await updateDatePhoto(serverId!, `${LOCAL_PHOTOS_DIR}${local.photoFile}`);
    await markDate(local._id, { photoImported: true });
  }

  await markDate(local._id, { importDone: true });
  return merged ? "merged" : "created";
}

/**
 * Importe tout ce qui ne l'est pas encore, puis efface les données locales
 * si — et seulement si — tout est passé.
 */
export async function importLocalIntoAccount(
  onProgress?: (p: ImportProgress) => void,
): Promise<MigrationResult> {
  const result: MigrationResult = {
    cards: 0,
    merged: 0,
    wishlist: 0,
    failures: [],
    offline: false,
    cleared: false,
  };

  // État actuel du compte, pour ne rien recréer qui y soit déjà
  let serverDates: DateEntry[];
  let serverWishlist: WishlistItem[];
  try {
    [serverDates, { data: serverWishlist }] = await Promise.all([
      api<DateEntry[]>("/date"),
      api<{ data: WishlistItem[] }>("/wishlist"),
    ]);
  } catch (e) {
    if (e instanceof NetworkError) return { ...result, offline: true };
    throw e;
  }
  const serverByKey = new Map(
    serverDates.filter((d) => !d.linkedUser).map((d) => [dayKey(d), d]),
  );

  const dates = (await readLocal("dates")).filter((d) => !d.importDone);
  const items = (await readLocal("wishlist")).filter((w) => !w.importedAs);
  const total = dates.length + items.length;
  let done = 0;

  for (const d of dates) {
    onProgress?.({ done, total, current: d.name });
    try {
      const r = await importDate(d, serverByKey);
      if (r === "created") result.cards++;
      else result.merged++;
    } catch (e) {
      result.failures.push(`${d.name}${d.surname ? " " + d.surname : ""}`.trim());
      if (e instanceof NetworkError) {
        result.offline = true;
        break; // inutile d'insister sans réseau
      }
    }
    done++;
  }

  if (!result.offline) {
    const serverWishKeys = new Set(serverWishlist.map(wishKey));
    for (const w of items) {
      onProgress?.({ done, total, current: w.title });
      try {
        let serverId: string | undefined;
        if (!serverWishKeys.has(wishKey(w))) {
          const res = await api<{ data: WishlistItem }>("/wishlist", {
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
          serverId = res.data?._id;
          result.wishlist++;
        }
        await updateLocal("wishlist", (list) =>
          list.map((it) =>
            it._id === w._id ? { ...it, importedAs: serverId ?? "existing" } : it,
          ),
        );
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

  // Réglages d'affichage du mode local → profil du compte (best effort)
  if (result.failures.length === 0) {
    const prefs = (await readLocal("prefs"))[0];
    if (prefs && (prefs.hideNamedaysOnCards !== undefined || prefs.showTodayNamedayOnHome !== undefined)) {
      await updateMe({
        ...(prefs.hideNamedaysOnCards !== undefined && { hideNamedaysOnCards: prefs.hideNamedaysOnCards }),
        ...(prefs.showTodayNamedayOnHome !== undefined && { showTodayNamedayOnHome: prefs.showTodayNamedayOnHome }),
      }).catch(() => {});
    }
  }

  // Effacement UNIQUEMENT si tout est confirmé par le serveur
  if (result.failures.length === 0 && !result.offline && !(await hasLocalDataToImport())) {
    await clearLocalData();
    result.cleared = true;
  }
  return result;
}

/** « Ne pas importer » : abandon volontaire des données locales. */
export async function discardLocalData(): Promise<void> {
  await clearLocalData();
}
