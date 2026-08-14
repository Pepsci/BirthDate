import { api, API_URL, getToken, setToken } from "./api";
import { uploadAsync, FileSystemUploadType } from "expo-file-system/legacy";
import { GiftStatus } from "./giftStatus";

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
}

export async function fetchDates(): Promise<DateEntry[]> {
  return api<DateEntry[]>("/date");
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
  const total = Math.max(0, next.getTime() - from.getTime());
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

export async function createDate(payload: DatePayload): Promise<DateEntry> {
  return api<DateEntry>("/date", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateDate(
  id: string,
  payload: Partial<DatePayload>,
): Promise<DateEntry> {
  return api<DateEntry>(`/date/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deleteDate(id: string): Promise<void> {
  await api(`/date/${id}`, { method: "DELETE" });
}

/** (Dé)marque une date comme "famille" — fonctionne aussi pour un ami lié. */
export async function setDateFamily(
  id: string,
  family: boolean,
): Promise<DateEntry> {
  return api<DateEntry>(`/date/${id}/family`, {
    method: "PATCH",
    body: JSON.stringify({ family }),
  });
}

export async function fetchDate(id: string): Promise<DateEntry> {
  return api<DateEntry>(`/date/${id}`);
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
  await api(`/date/${id}/notifications`, {
    method: "PUT",
    body: JSON.stringify({ receiveNotifications }),
  });
}

export async function setBirthdayPrefs(
  id: string,
  prefs: NotificationPrefs,
): Promise<void> {
  await api(`/date/${id}/notification-preferences`, {
    method: "PUT",
    body: JSON.stringify(prefs),
  });
}

export async function setNamedayPrefs(
  id: string,
  prefs: NamedayPrefs,
): Promise<void> {
  await api(`/date/${id}/nameday-preferences`, {
    method: "PUT",
    body: JSON.stringify(prefs),
  });
}
