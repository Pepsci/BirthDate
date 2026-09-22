import {
  copyAsync,
  deleteAsync,
  getInfoAsync,
  makeDirectoryAsync,
} from "expo-file-system/legacy";
import { ApiError } from "./api";
import type {
  DateEntry,
  DatePayload,
  Gift,
  NamedayPrefs,
  NotificationPrefs,
} from "./dates";
import type { WishlistItem } from "./wishlist";
import {
  LOCAL_PHOTOS_DIR,
  LocalDate,
  LocalWishlistItem,
  newLocalId,
  readLocal,
  updateLocal,
} from "./local-store";
import { findNameDay } from "./nameday";

/**
 * Version « sur le téléphone » des fonctions de dates.ts et wishlist.ts,
 * utilisée en mode local (docs/MODE_LOCAL.md § 5.2).
 *
 * Règle : chaque fonction reproduit le comportement de la route serveur
 * correspondante (server/routes/date.js, wishlist.js) — mêmes valeurs par
 * défaut, même calcul de fête, même erreur 404. Un écran ne doit voir
 * aucune différence entre les deux modes.
 *
 * Les erreurs métier sont des ApiError (404, 400) : les écrans les
 * affichent déjà via `e.message`.
 */

const notFound = () => new ApiError(404, "Cette carte n'existe plus.");

// ---- Conversion stockage → écran ----

/** Recalcule le chemin complet de la photo (voir LocalDate dans local-store). */
function toEntry(d: LocalDate): DateEntry {
  const { photoFile, createdAt: _createdAt, ...rest } = d;
  return {
    ...rest,
    linkedUser: null, // pas d'amis en mode local
    photo: photoFile ? `${LOCAL_PHOTOS_DIR}${photoFile}` : null,
  };
}

/**
 * Modifie UNE carte dans une seule écriture. `fn` reçoit une copie et
 * renvoie la nouvelle version ; si la carte n'existe pas, 404 et rien
 * n'est écrit.
 */
async function mutateDate(
  id: string,
  fn: (d: LocalDate) => LocalDate,
): Promise<LocalDate> {
  let result: LocalDate | undefined;
  await updateLocal("dates", (items) => {
    const i = items.findIndex((d) => d._id === id);
    if (i < 0) throw notFound();
    result = fn(items[i]);
    items[i] = result;
    return items;
  });
  return result!;
}

// ---- Lecture ----

export async function localFetchDates(): Promise<DateEntry[]> {
  return (await readLocal("dates")).map(toEntry);
}

export async function localFetchDate(id: string): Promise<DateEntry> {
  const found = (await readLocal("dates")).find((d) => d._id === id);
  if (!found) throw notFound();
  return toEntry(found);
}

// ---- Création / modification / suppression ----

export async function localCreateDate(payload: DatePayload): Promise<DateEntry> {
  const entry: LocalDate = {
    _id: newLocalId(),
    date: payload.date,
    name: payload.name,
    surname: payload.surname ?? "",
    family: !!payload.family,
    // Comme POST /date : fête fournie, sinon déduite du prénom
    nameday: payload.nameday || findNameDay(payload.name),
    linkedUser: null,
    photoFile: null,
    sharedGiftList: null,
    gifts: [],
    // Valeurs par défaut du schéma serveur (models/date.model.js)
    receiveNotifications: true,
    notificationPreferences: { timings: [1], notifyOnBirthday: true },
    namedayPreferences: { timings: [1], notifyOnNameday: true },
    createdAt: Date.now(),
  };
  await updateLocal("dates", (items) => [...items, entry]);
  return toEntry(entry);
}

export async function localUpdateDate(
  id: string,
  payload: Partial<DatePayload>,
): Promise<DateEntry> {
  if (payload.nameday && !/^\d{2}-\d{2}$/.test(payload.nameday)) {
    throw new ApiError(400, "Format de fête invalide (MM-JJ attendu).");
  }
  const updated = await mutateDate(id, (d) => {
    // Comme PATCH /date/:id : fête explicite > recalcul si le prénom change
    // > fête actuelle conservée
    const nameday =
      payload.nameday !== undefined
        ? payload.nameday || null
        : payload.name && payload.name !== d.name
          ? findNameDay(payload.name)
          : d.nameday;
    // Un champ absent (undefined) ne remplace pas la valeur existante
    const defined = Object.fromEntries(
      Object.entries(payload).filter(([, v]) => v !== undefined),
    );
    return { ...d, ...defined, nameday };
  });
  return toEntry(updated);
}

export async function localDeleteDate(id: string): Promise<void> {
  let photoFile: string | null | undefined;
  await updateLocal("dates", (items) => {
    const found = items.find((d) => d._id === id);
    if (!found) throw notFound();
    photoFile = found.photoFile;
    return items.filter((d) => d._id !== id);
  });
  // Après l'écriture seulement : une carte jamais sans sa photo
  if (photoFile) await deletePhotoFile(photoFile);
}

export async function localSetDateFamily(
  id: string,
  family: boolean,
): Promise<DateEntry> {
  return toEntry(await mutateDate(id, (d) => ({ ...d, family })));
}

// ---- Photo ----

async function deletePhotoFile(file: string) {
  try {
    await deleteAsync(`${LOCAL_PHOTOS_DIR}${file}`, { idempotent: true });
  } catch (e) {
    console.warn("[local-dates] photo non supprimée", e);
  }
}

/**
 * Copie l'image (déjà recadrée en JPEG par DateForm) dans local-data/photos/.
 * Nom unique à chaque changement : sinon l'image en cache d'expo-image
 * continuerait d'afficher l'ancienne photo.
 */
export async function localUpdateDatePhoto(
  id: string,
  imageUri: string,
): Promise<DateEntry> {
  const info = await getInfoAsync(LOCAL_PHOTOS_DIR);
  if (!info.exists) {
    await makeDirectoryAsync(LOCAL_PHOTOS_DIR, { intermediates: true });
  }
  const file = `${id}-${Date.now()}.jpg`;
  await copyAsync({ from: imageUri, to: `${LOCAL_PHOTOS_DIR}${file}` });

  let previous: string | null | undefined;
  try {
    const updated = await mutateDate(id, (d) => {
      previous = d.photoFile;
      return { ...d, photoFile: file };
    });
    if (previous) await deletePhotoFile(previous);
    return toEntry(updated);
  } catch (e) {
    await deletePhotoFile(file); // carte introuvable : pas de fichier orphelin
    throw e;
  }
}

export async function localRemoveDatePhoto(id: string): Promise<DateEntry> {
  let previous: string | null | undefined;
  const updated = await mutateDate(id, (d) => {
    previous = d.photoFile;
    return { ...d, photoFile: null };
  });
  if (previous) await deletePhotoFile(previous);
  return toEntry(updated);
}

// ---- Idées cadeaux ----

type GiftInput = {
  giftName: string;
  occasion?: string;
  year?: number;
  url?: string;
  price?: number;
  image?: string;
  purchased?: boolean;
  status?: Gift["status"];
};

export async function localAddGift(
  dateId: string,
  gift: GiftInput,
): Promise<DateEntry> {
  const full: Gift = {
    _id: newLocalId(),
    giftName: gift.giftName,
    occasion: gift.occasion ?? "Anniversaire",
    year: gift.year ?? new Date().getFullYear(),
    purchased: !!gift.purchased,
    // Comme PATCH /date/:id/gifts
    status: gift.status || (gift.purchased ? "bought" : "to_buy"),
    purchasedAt: null,
    url: gift.url || null,
    price: gift.price ?? null,
    image: gift.image || null,
  };
  return toEntry(
    await mutateDate(dateId, (d) => ({ ...d, gifts: [...(d.gifts ?? []), full] })),
  );
}

export async function localUpdateGift(
  dateId: string,
  gift: Gift,
): Promise<DateEntry> {
  // Comme PATCH /date/:id/gifts/:giftId : le statut pilote `purchased`
  const status = gift.status || (gift.purchased ? "bought" : "to_buy");
  const purchased = gift.status != null ? gift.status !== "to_buy" : !!gift.purchased;
  return toEntry(
    await mutateDate(dateId, (d) => {
      const gifts = d.gifts ?? [];
      if (!gifts.some((g) => g._id === gift._id)) {
        throw new ApiError(404, "Cette idée de cadeau n'existe plus.");
      }
      return {
        ...d,
        gifts: gifts.map((g) =>
          g._id === gift._id
            ? {
                ...g,
                ...gift,
                status,
                purchased,
                url: gift.url || null,
                price: gift.price ? Number(gift.price) : null,
                image: gift.image || null,
              }
            : g,
        ),
      };
    }),
  );
}

export async function localDeleteGift(
  dateId: string,
  giftId: string,
): Promise<void> {
  await mutateDate(dateId, (d) => ({
    ...d,
    gifts: (d.gifts ?? []).filter((g) => g._id !== giftId),
  }));
}

// ---- Préférences de rappel (utilisées par les rappels locaux, étape 4) ----

export async function localSetDateNotifications(
  id: string,
  receiveNotifications: boolean,
): Promise<void> {
  await mutateDate(id, (d) => ({ ...d, receiveNotifications }));
}

export async function localSetBirthdayPrefs(
  id: string,
  prefs: NotificationPrefs,
): Promise<void> {
  await mutateDate(id, (d) => ({ ...d, notificationPreferences: prefs }));
}

export async function localSetNamedayPrefs(
  id: string,
  prefs: NamedayPrefs,
): Promise<void> {
  if (!prefs.timings.every((t) => t === 1 || t === 7)) {
    throw new ApiError(
      400,
      "Les rappels de fête sont possibles la veille ou une semaine avant.",
    );
  }
  await mutateDate(id, (d) => ({ ...d, namedayPreferences: prefs }));
}

// ---- Liste d'envies ----

const itemNotFound = () => new ApiError(404, "Cette envie n'existe plus.");

function toItem({ createdAt: _c, ...item }: LocalWishlistItem): WishlistItem {
  return item;
}

/** Même ordre que GET /wishlist : non achetés d'abord, puis plus récents. */
export async function localFetchMyWishlist(): Promise<WishlistItem[]> {
  const items = await readLocal("wishlist");
  return items
    .sort(
      (a, b) =>
        Number(a.isPurchased) - Number(b.isPurchased) ||
        (b.createdAt ?? 0) - (a.createdAt ?? 0),
    )
    .map(toItem);
}

export async function localAddWishlistItem(item: {
  title: string;
  price?: number;
  url?: string;
  description?: string;
  image?: string;
  isShared?: boolean;
}): Promise<void> {
  if (!item.title) throw new ApiError(400, "Le titre est obligatoire.");
  const full: LocalWishlistItem = {
    _id: newLocalId(),
    title: item.title,
    price: item.price ?? null,
    url: item.url || null,
    description: item.description || null,
    image: item.image || null,
    isPurchased: false,
    isShared: item.isShared ?? true,
    reservedBy: null,
    reservedByGuest: null,
    createdAt: Date.now(),
  };
  await updateLocal("wishlist", (items) => [...items, full]);
}

async function mutateItem(
  id: string,
  fn: (i: LocalWishlistItem) => LocalWishlistItem,
): Promise<LocalWishlistItem> {
  let result: LocalWishlistItem | undefined;
  await updateLocal("wishlist", (items) => {
    const i = items.findIndex((it) => it._id === id);
    if (i < 0) throw itemNotFound();
    result = fn(items[i]);
    items[i] = result;
    return items;
  });
  return result!;
}

export async function localUpdateWishlistItem(
  id: string,
  fields: Partial<WishlistItem>,
): Promise<void> {
  const defined = Object.fromEntries(
    Object.entries(fields).filter(([, v]) => v !== undefined),
  );
  await mutateItem(id, (it) => ({ ...it, ...defined }));
}

export async function localToggleWishlistItemSharing(
  id: string,
): Promise<WishlistItem> {
  return toItem(await mutateItem(id, (it) => ({ ...it, isShared: !it.isShared })));
}

export async function localDeleteWishlistItem(id: string): Promise<void> {
  await updateLocal("wishlist", (items) => {
    if (!items.some((it) => it._id === id)) throw itemNotFound();
    return items.filter((it) => it._id !== id);
  });
}
