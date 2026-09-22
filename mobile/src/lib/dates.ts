import {
  api,
  API_URL,
  ApiError,
  getToken,
  setToken,
  NetworkError,
} from "./api";
import { readCache, writeCache } from "./offline-cache";
import { noteCacheServed } from "./offline-status";
import {
  applyQueue,
  applyQueueToEntry,
  isTempId,
  queueCreate,
  queueDelete,
  queueUpdate,
  resolveId,
} from "./offline-queue";
import { uploadAsync, FileSystemUploadType } from "expo-file-system/legacy";
import { GiftStatus } from "./giftStatus";
import { assertAccountMode, isLocalMode } from "./app-mode";
// Mode local (sans compte) : chaque fonction ci-dessous commence par un
// aiguillage vers local-dates.ts. Même signature, les écrans ne voient rien.
import {
  localAddGift,
  localCreateDate,
  localDeleteDate,
  localDeleteGift,
  localFetchDate,
  localFetchDates,
  localRemoveDatePhoto,
  localSetBirthdayPrefs,
  localSetDateFamily,
  localSetDateNotifications,
  localSetNamedayPrefs,
  localUpdateDate,
  localUpdateDatePhoto,
  localUpdateGift,
} from "./local-dates";

export interface LinkedUser {
  _id: string;
  name: string;
  surname: string;
  email?: string;
  avatar?: string;
  birthDate?: string;
  nameday?: string; // "MM-DD"
}

export interface DateEntry {
  _id: string;
  date: string; // ISO
  name: string;
  surname?: string;
  nameday?: string | null; // "MM-DD"
  family: boolean;
  linkedUser: LinkedUser | null;
  photo?: string | null; // dates manuelles uniquement
  sharedGiftList?: string | null;
  conversationId?: string;
  gifts?: Gift[];
  receiveNotifications?: boolean;
  notificationPreferences?: { timings: number[]; notifyOnBirthday: boolean };
  namedayPreferences?: { timings: number[]; notifyOnNameday: boolean };
  /** Ajoutée ou modifiée hors ligne, pas encore envoyée au serveur. */
  pending?: boolean;
}

// ---- Cache hors ligne ----
// Chaque lecture réussie met le cache à jour ; sans réseau (NetworkError
// uniquement), on renvoie la dernière version enregistrée. Une erreur HTTP
// (401, 500…) n'est jamais masquée par le cache.
const DATES_CACHE_KEY = "dates";
const dateCacheKey = (id: string) => `date-${id}`;

/** Dernière liste enregistrée sur le téléphone, pour un affichage immédiat. */
export async function getCachedDates(): Promise<{
  dates: DateEntry[];
  savedAt: number;
} | null> {
  // Mode local : les données du téléphone SONT la source, pas un cache
  if (isLocalMode()) return { dates: await localFetchDates(), savedAt: Date.now() };
  const cached = await readCache<DateEntry[]>(DATES_CACHE_KEY);
  return cached
    ? { dates: applyQueue(cached.data), savedAt: cached.savedAt }
    : null;
}

// La file d'attente hors ligne est toujours superposée au résultat : même en
// ligne, une modification pas encore envoyée ne doit pas disparaître de l'écran.
// Le cache, lui, ne stocke que la version serveur.
export async function fetchDates(): Promise<DateEntry[]> {
  if (isLocalMode()) return localFetchDates();
  try {
    const dates = await api<DateEntry[]>("/date");
    writeCache(DATES_CACHE_KEY, dates); // sans attendre : n'allonge pas l'affichage
    return applyQueue(dates);
  } catch (e) {
    if (e instanceof NetworkError) {
      const cached = await readCache<DateEntry[]>(DATES_CACHE_KEY);
      if (cached) {
        noteCacheServed(cached.savedAt);
        return applyQueue(cached.data);
      }
    }
    throw e;
  }
}

// ---- Helpers dates ----
// Règle projet : les anniversaires se comparent en mois + jour uniquement
// (récurrence annuelle), et on parse avec new Date(y, m, d) pour éviter
// les décalages de timezone.

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Prochaine occurrence (cette année ou l'année prochaine) */
export function nextOccurrence(iso: string, from = new Date()): Date {
  const birth = new Date(iso);
  const today = startOfDay(from);
  let next = new Date(today.getFullYear(), birth.getMonth(), birth.getDate());
  if (next < today) {
    next = new Date(today.getFullYear() + 1, birth.getMonth(), birth.getDate());
  }
  return next;
}

/** Jours restants avant la prochaine occurrence (0 = aujourd'hui) */
export function daysUntil(iso: string, from = new Date()): number {
  const diff = nextOccurrence(iso, from).getTime() - startOfDay(from).getTime();
  return Math.round(diff / 86_400_000);
}

/** Âge que la personne AURA à sa prochaine occurrence */
export function upcomingAge(iso: string, from = new Date()): number {
  const birth = new Date(iso);
  return nextOccurrence(iso, from).getFullYear() - birth.getFullYear();
}

/** Âge ACTUEL de la personne (celui qu'elle a aujourd'hui) */
export function currentAge(iso: string, from = new Date()): number {
  const birth = new Date(iso);
  let age = from.getFullYear() - birth.getFullYear();
  const monthDiff = from.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && from.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

export interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  total: number; // ms restants
}

/** Temps restant (j/h/m/s) jusqu'à la prochaine occurrence, façon Countdown web */
export function timeUntilNext(iso: string, from = new Date()): TimeLeft {
  const birth = new Date(iso);
  let next = new Date(from.getFullYear(), birth.getMonth(), birth.getDate());
  if (next.getTime() <= from.getTime()) {
    next = new Date(from.getFullYear() + 1, birth.getMonth(), birth.getDate());
  }
  return timeUntil(next, from);
}

/** Temps restant avant une date précise, sans récurrence (événements). */
export function timeUntil(target: Date, from = new Date()): TimeLeft {
  const total = Math.max(0, target.getTime() - from.getTime());
  return {
    days: Math.floor(total / 86_400_000),
    hours: Math.floor((total % 86_400_000) / 3_600_000),
    minutes: Math.floor((total % 3_600_000) / 60_000),
    seconds: Math.floor((total % 60_000) / 1_000),
    total,
  };
}

const MONTHS_FR = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

/** "13 mars" */
export function formatBirthday(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS_FR[d.getMonth()]}`;
}

/** "13 mars 1990" — date de naissance complète */
export function formatFullDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS_FR[d.getMonth()]} ${d.getFullYear()}`;
}

/** "13 mars" depuis un nameday "MM-DD" */
export function formatNameday(mmdd: string): string {
  const [mm, dd] = mmdd.split("-").map(Number);
  return `${dd} ${MONTHS_FR[mm - 1]}`;
}

/**
 * "0 an" · "1 an" · "34 ans" — le pluriel français ne s'applique qu'à
 * partir de 2. Utilisé partout où un âge est affiché sur une carte.
 */
export function formatAge(age: number): string {
  return `${age} an${age >= 2 ? "s" : ""}`;
}

/** Libellé du countdown */
export function countdownLabel(days: number): string {
  if (days === 0) return "Aujourd'hui 🎂";
  if (days === 1) return "Demain";
  return `J-${days}`;
}

// ---- CRUD dates manuelles ----

export interface DatePayload {
  name: string;
  surname?: string;
  date: string; // ISO
  family?: boolean;
  nameday?: string | null; // "MM-DD" — auto-détecté côté serveur si absent
}

// Sans réseau, ces trois fonctions déposent l'opération dans la file
// d'attente (lib/offline-queue.ts) au lieu d'échouer : l'écran se comporte
// comme en ligne, et l'envoi se fait au retour de la connexion.

export async function createDate(payload: DatePayload): Promise<DateEntry> {
  if (isLocalMode()) return localCreateDate(payload);
  try {
    return await api<DateEntry>("/date", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  } catch (e) {
    if (e instanceof NetworkError) return queueCreate(payload);
    throw e;
  }
}

export async function updateDate(
  id: string,
  payload: Partial<DatePayload>,
): Promise<DateEntry> {
  if (isLocalMode()) return localUpdateDate(id, payload);
  const realId = resolveId(id);
  const queueIt = async () => {
    await queueUpdate(realId, payload);
    const base = await cachedEntry(realId);
    return (
      applyQueueToEntry(realId, base) ?? ({ _id: realId, ...payload } as DateEntry)
    );
  };
  // Carte créée hors ligne et pas encore envoyée : on complète la création
  if (isTempId(realId)) return queueIt();
  try {
    return await api<DateEntry>(`/date/${realId}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  } catch (e) {
    if (e instanceof NetworkError) return queueIt();
    throw e;
  }
}

export async function deleteDate(id: string): Promise<void> {
  if (isLocalMode()) return localDeleteDate(id);
  const realId = resolveId(id);
  const queueIt = async () => {
    const entry = await cachedEntry(realId);
    const label =
      `${entry?.name ?? ""} ${entry?.surname ?? ""}`.trim() || "une carte";
    await queueDelete(realId, label);
  };
  if (isTempId(realId)) return queueIt();
  try {
    await api(`/date/${realId}`, { method: "DELETE" });
  } catch (e) {
    if (e instanceof NetworkError) return queueIt();
    throw e;
  }
}

/** Version en cache d'une carte (détail si déjà ouverte, sinon celle de la liste). */
async function cachedEntry(id: string): Promise<DateEntry | null> {
  const detail = await readCache<DateEntry>(dateCacheKey(id));
  if (detail) return detail.data;
  const list = await readCache<DateEntry[]>(DATES_CACHE_KEY);
  return list?.data.find((d) => d._id === id) ?? null;
}

/** (Dé)marque une date comme "famille" — fonctionne aussi pour un ami lié. */
export async function setDateFamily(
  id: string,
  family: boolean,
): Promise<DateEntry> {
  if (isLocalMode()) return localSetDateFamily(id, family);
  return api<DateEntry>(`/date/${id}/family`, {
    method: "PATCH",
    body: JSON.stringify({ family }),
  });
}

export async function fetchDate(id: string): Promise<DateEntry> {
  if (isLocalMode()) return localFetchDate(id);
  const realId = resolveId(id);
  const notFound = () => new ApiError(404, "Cette carte n'existe plus.");

  // Carte créée hors ligne, pas encore envoyée : elle n'existe que dans la file
  if (isTempId(realId)) {
    const pending = applyQueueToEntry(realId, null);
    if (pending) return pending;
    throw notFound();
  }

  try {
    const date = await api<DateEntry>(`/date/${realId}`);
    writeCache(dateCacheKey(realId), date);
    const withQueue = applyQueueToEntry(realId, date);
    if (!withQueue) throw notFound(); // suppression en attente
    return withQueue;
  } catch (e) {
    if (e instanceof NetworkError) {
      // D'abord la carte détaillée si elle a déjà été ouverte, sinon la
      // version de la liste (moins complète, mais mieux que rien).
      const detail = await readCache<DateEntry>(dateCacheKey(realId));
      const list = detail
        ? null
        : await readCache<DateEntry[]>(DATES_CACHE_KEY);
      const base = detail?.data ?? list?.data.find((d) => d._id === realId);
      const savedAt = detail?.savedAt ?? list?.savedAt;
      if (base && savedAt) {
        noteCacheServed(savedAt);
        const withQueue = applyQueueToEntry(realId, base);
        if (!withQueue) throw notFound();
        return withQueue;
      }
    }
    throw e;
  }
}

/**
 * PATCH /date/:id/photo en multipart (champ "photo") — même technique que
 * updateAvatar() dans lib/users.ts (uploadAsync plutôt que fetch+FormData,
 * seul moyen fiable d'envoyer du multipart sur iOS).
 */
export async function updateDatePhoto(
  id: string,
  imageUri: string,
): Promise<DateEntry> {
  if (isLocalMode()) return localUpdateDatePhoto(id, imageUri);
  assertAccountMode("upload photo de carte");
  const token = await getToken();
  const res = await uploadAsync(`${API_URL}/api/date/${id}/photo`, imageUri, {
    httpMethod: "PATCH",
    uploadType: FileSystemUploadType.MULTIPART,
    fieldName: "photo",
    mimeType: "image/jpeg",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  const data = res.body ? JSON.parse(res.body) : {};
  if (res.status < 200 || res.status >= 300) {
    throw new Error(data?.message ?? `Erreur ${res.status}`);
  }
  if (data.authToken) await setToken(data.authToken);
  return data;
}

export async function removeDatePhoto(id: string): Promise<DateEntry> {
  if (isLocalMode()) return localRemoveDatePhoto(id);
  assertAccountMode("suppression photo de carte");
  const token = await getToken();
  const res = await fetch(`${API_URL}/api/date/${id}/photo`, {
    method: "PATCH",
    headers: {
      "Content-Type": "multipart/form-data",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: (() => {
      const fd = new FormData();
      fd.append("removePhoto", "true");
      return fd;
    })(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message ?? `Erreur ${res.status}`);
  return data;
}

// ---- Idées cadeaux par date ----

export interface Gift {
  _id: string;
  giftName: string;
  purchased: boolean;
  status?: GiftStatus;
  occasion: string;
  year: number;
  purchasedAt?: string | null;
  url?: string | null;
  price?: number | null;
  image?: string | null;
}

export async function addGift(
  dateId: string,
  gift: {
    giftName: string;
    occasion?: string;
    year?: number;
    url?: string;
    price?: number;
    image?: string;
  },
): Promise<DateEntry> {
  if (isLocalMode()) return localAddGift(dateId, gift);
  return api<DateEntry>(`/date/${dateId}/gifts`, {
    method: "PATCH",
    body: JSON.stringify({
      purchased: false,
      status: "to_buy",
      occasion: "Anniversaire",
      year: new Date().getFullYear(),
      ...gift,
    }),
  });
}

/**
 * ⚠️ Le back fait un $set de TOUS les champs : toujours envoyer le cadeau
 * complet (spread de l'existant), pas juste le champ modifié.
 */
export async function updateGift(
  dateId: string,
  gift: Gift,
): Promise<DateEntry> {
  if (isLocalMode()) return localUpdateGift(dateId, gift);
  const { _id, ...fields } = gift;
  return api<DateEntry>(`/date/${dateId}/gifts/${_id}`, {
    method: "PATCH",
    body: JSON.stringify(fields),
  });
}

export async function deleteGift(
  dateId: string,
  giftId: string,
): Promise<void> {
  if (isLocalMode()) return localDeleteGift(dateId, giftId);
  await api(`/date/${dateId}/gifts/${giftId}`, { method: "DELETE" });
}

// ---- Préférences de notifications par date ----

export interface NotificationPrefs {
  timings: number[]; // 1, 3, 7, 14, 30
  notifyOnBirthday: boolean;
}

export interface NamedayPrefs {
  timings: number[]; // 1 (veille) ou 7 (semaine avant)
  notifyOnNameday: boolean;
}

export async function setDateNotifications(
  id: string,
  receiveNotifications: boolean,
): Promise<void> {
  if (isLocalMode()) return localSetDateNotifications(id, receiveNotifications);
  await api(`/date/${id}/notifications`, {
    method: "PUT",
    body: JSON.stringify({ receiveNotifications }),
  });
}

export async function setBirthdayPrefs(
  id: string,
  prefs: NotificationPrefs,
): Promise<void> {
  if (isLocalMode()) return localSetBirthdayPrefs(id, prefs);
  await api(`/date/${id}/notification-preferences`, {
    method: "PUT",
    body: JSON.stringify(prefs),
  });
}

export async function setNamedayPrefs(
  id: string,
  prefs: NamedayPrefs,
): Promise<void> {
  if (isLocalMode()) return localSetNamedayPrefs(id, prefs);
  await api(`/date/${id}/nameday-preferences`, {
    method: "PUT",
    body: JSON.stringify(prefs),
  });
}
