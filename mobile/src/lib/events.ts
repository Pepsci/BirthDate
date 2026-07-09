import { api } from "./api";

export type EventType = "birthday" | "party" | "dinner" | "other";
export type EventStatus = "draft" | "published" | "cancelled" | "done";
export type RsvpStatus = "pending" | "accepted" | "declined" | "maybe";

export interface EventEntry {
  _id: string;
  shortId: string;
  title: string;
  type: EventType;
  dateMode: "fixed" | "vote";
  fixedDate?: string | null;
  selectedDate?: string | null;
  locationMode: "fixed" | "vote";
  fixedLocation?:
    | string
    | {
        name?: string;
        address?: string;
        coordinates?: { lat: number; lng: number } | null;
      }
    | null;
  status: EventStatus;
  organizer?: { _id: string; name: string; surname: string } | string;
  forPerson?: { _id: string; name: string; surname: string } | null;
  myRsvpStatus?: RsvpStatus; // présent uniquement sur les events "invited"
}

export interface MyEvents {
  organized: EventEntry[];
  invited: EventEntry[];
}

export async function fetchMyEvents(): Promise<MyEvents> {
  return api<MyEvents>("/events/mine");
}

/** Date effective d'un event : selectedDate > fixedDate > null (vote en cours) */
export function eventDate(e: EventEntry): Date | null {
  const iso = e.selectedDate ?? e.fixedDate;
  return iso ? new Date(iso) : null;
}

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  birthday: "🎂 Anniversaire",
  party: "🎉 Fête",
  dinner: "🍽️ Dîner",
  other: "📌 Autre",
};

export const STATUS_LABELS: Record<EventStatus, string> = {
  draft: "Brouillon",
  published: "Publié",
  cancelled: "Annulé",
  done: "Terminé",
};

export const RSVP_LABELS: Record<RsvpStatus, string> = {
  pending: "En attente",
  accepted: "✅ J'y vais",
  declined: "❌ Décliné",
  maybe: "🤷 Peut-être",
};

/** "vendredi 3 juillet 2026 à 19:30" (sans lib externe) */
export function formatEventDate(d: Date): string {
  return d.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: d.getHours() || d.getMinutes() ? "2-digit" : undefined,
    minute: d.getHours() || d.getMinutes() ? "2-digit" : undefined,
  });
}

// ---- Détail d'un événement ----

export interface EventInvitationEntry {
  _id: string;
  user: {
    _id: string;
    name: string;
    surname: string;
    avatar?: string;
    publicKey?: string | null;
  } | null;
  guestName?: string | null;
  status: RsvpStatus;
  dateVote?: string[];
  locationVote?: string | null;
}

export interface LocationOption {
  _id: string;
  name?: string;
  address?: string;
}

export interface EventDetail extends EventEntry {
  description?: string;
  organizer: {
    _id: string;
    name: string;
    surname: string;
    avatar?: string;
    publicKey?: string | null;
  };
  giftMode?: "imposed" | "proposals";
  allowGuestInvites?: boolean;
  allowExternalGuests?: boolean;
  maxGuests?: number | null;
  imposedGifts?: { _id?: string; name: string; url?: string; price?: number }[];
  dateOptions?: string[];
  locationOptions?: LocationOption[];
  selectedLocation?: {
    name?: string;
    address?: string;
    coordinates?: { lat: number; lng: number } | null;
  } | null;
  invitations?: EventInvitationEntry[];
  hasFullAccess: boolean;
}

export async function fetchEvent(shortId: string): Promise<EventDetail> {
  return api<EventDetail>(`/events/${shortId}`);
}

export async function sendRsvp(
  shortId: string,
  status: Exclude<RsvpStatus, "pending">,
): Promise<void> {
  await api(`/events/${shortId}/rsvp`, {
    method: "PUT",
    body: JSON.stringify({ status }),
  });
}

/** Nom affichable d'un invité (user inscrit ou guest externe) */
export function invitationName(inv: EventInvitationEntry): string {
  if (inv.user) return `${inv.user.name} ${inv.user.surname ?? ""}`.trim();
  return inv.guestName || "Invité externe";
}

export async function voteDate(shortId: string, dates: string[]): Promise<void> {
  await api(`/events/${shortId}/vote/date`, {
    method: "POST",
    body: JSON.stringify({ dates }),
  });
}

export async function voteLocation(
  shortId: string,
  locationId: string,
): Promise<void> {
  await api(`/events/${shortId}/vote/location`, {
    method: "POST",
    body: JSON.stringify({ locationId }),
  });
}

/** Clé de comparaison stable pour une date ISO */
export function dateKey(iso: string): string {
  return new Date(iso).toISOString();
}

/** Nombre de votes pour une option de date */
export function countDateVotes(
  invitations: EventInvitationEntry[],
  optionIso: string,
): number {
  const key = dateKey(optionIso);
  return invitations.filter((inv) =>
    (inv.dateVote ?? []).some((v) => dateKey(v) === key),
  ).length;
}

/** Nombre de votes pour une option de lieu */
export function countLocationVotes(
  invitations: EventInvitationEntry[],
  locationId: string,
): number {
  return invitations.filter((inv) => inv.locationVote === locationId).length;
}

// ---- Cadeaux ----

export interface GiftProposal {
  _id: string;
  name: string;
  url?: string | null;
  price?: number | null;
  image?: string | null;
  proposedBy: { _id: string; name: string; surname?: string } | null;
  guestName?: string | null;
  votes: string[]; // userIds
  selected?: boolean; // retenu par l'organisateur
}

export async function fetchGifts(shortId: string): Promise<GiftProposal[]> {
  return api<GiftProposal[]>(`/events/${shortId}/gifts`);
}

export async function proposeGift(
  shortId: string,
  gift: { name: string; url?: string; price?: number; image?: string },
): Promise<void> {
  await api(`/events/${shortId}/gifts`, {
    method: "POST",
    body: JSON.stringify(gift),
  });
}

/** Vote toggle : un appel ajoute ou retire le vote */
export async function toggleGiftVote(
  shortId: string,
  giftId: string,
): Promise<void> {
  await api(`/events/${shortId}/gifts/${giftId}/vote`, { method: "POST" });
}

/** (Dé)sélectionne un cadeau — organisateur uniquement */
export async function toggleGiftSelection(
  shortId: string,
  giftId: string,
): Promise<void> {
  await api(`/events/${shortId}/gifts/${giftId}/select`, { method: "PATCH" });
}

// ---- Chat événement ----

export interface EventChatMessage {
  _id: string;
  content: string;
  sender: {
    _id: string;
    name: string;
    surname?: string;
    avatar?: string;
    publicKey?: string | null;
  } | null;
  createdAt: string;
  isEncrypted?: boolean;
  encryptedFor?: Record<string, string>;
  readBy?: { user: string }[];
}

export async function fetchMessages(
  shortId: string,
): Promise<EventChatMessage[]> {
  return api<EventChatMessage[]>(`/events/${shortId}/messages`);
}

// ---- Partage & rejoindre ----

export async function fetchShare(
  shortId: string,
): Promise<{ url: string; code: string }> {
  return api<{ url: string; code: string }>(`/events/${shortId}/share`);
}

export async function joinEventByCode(
  shortId: string,
  accessCode: string,
): Promise<void> {
  await api(`/events/${shortId}/join`, {
    method: "POST",
    body: JSON.stringify({ accessCode }),
  });
}

// ---- Création & invitations ----

export interface CreateEventPayload {
  title: string;
  description?: string;
  type: EventType;
  forPerson?: string | null;
  forDate?: string | null;
  dateMode: "fixed" | "vote";
  fixedDate?: string;
  dateOptions?: string[];
  locationMode: "fixed" | "vote";
  fixedLocation?: {
    name: string;
    address?: string;
    coordinates?: { lat: number; lng: number };
  };
  locationOptions?: {
    name: string;
    address?: string;
    coordinates?: { lat: number; lng: number };
  }[];
  giftMode: "imposed" | "proposals";
  imposedGifts?: { name: string; url?: string; price?: number }[];
  maxGiftProposalsPerUser?: number | null;
  maxGuests?: number | null;
  allowExternalGuests?: boolean;
  allowGuestInvites?: boolean;
}

export async function createEvent(
  payload: CreateEventPayload,
): Promise<EventEntry> {
  return api<EventEntry>("/events", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function inviteToEvent(
  shortId: string,
  userIds: string[],
  externalEmails: string[] = [],
): Promise<void> {
  await api(`/events/${shortId}/invite`, {
    method: "POST",
    body: JSON.stringify({ userIds, externalEmails }),
  });
}

/** Vérifie si un event existe déjà pour un user (forPerson) ou une date (forDate) */
export async function checkExistingEvent(
  personOrDateId: string,
): Promise<string | null> {
  const res = await api<{ eventShortId?: string } | null>(
    `/events/check/${personOrDateId}`,
  );
  return res?.eventShortId ?? null;
}

export async function updateEvent(
  shortId: string,
  fields: Partial<CreateEventPayload> & { status?: EventStatus },
): Promise<EventEntry> {
  return api<EventEntry>(`/events/${shortId}`, {
    method: "PUT",
    body: JSON.stringify(fields),
  });
}

export async function deleteEvent(shortId: string): Promise<void> {
  await api(`/events/${shortId}`, { method: "DELETE" });
}

// ---- Cagnotte ----

export interface PoolContribution {
  id: string;
  amount: number; // centimes
  message?: string | null;
  createdAt: string;
  contributor: { name: string; surname?: string; avatar?: string | null } | null;
}

export interface PoolInfo {
  active: boolean;
  mode?: "free" | "goal";
  goal?: number | null; // centimes
  currency?: string;
  deadline?: string | null;
  totalCollected?: number; // centimes
  contributionsCount?: number;
  contributions?: PoolContribution[];
}

export async function fetchPool(shortId: string): Promise<PoolInfo> {
  return api<PoolInfo>(`/events/${shortId}/pool`);
}

export async function updatePool(
  shortId: string,
  config: {
    active: boolean;
    mode?: "free" | "goal";
    goal?: number | null;
    deadline?: string | null;
  },
): Promise<void> {
  await api(`/events/${shortId}/pool`, {
    method: "PUT",
    body: JSON.stringify(config),
  });
}

/** amount en CENTIMES (min 100 = 1 €) → clientSecret + compte connecté */
export async function contributeToPool(
  shortId: string,
  params: { amount: number; message?: string; anonymous?: boolean },
): Promise<{ clientSecret: string; stripeAccountId: string }> {
  return api(`/events/${shortId}/pool/contribute`, {
    method: "POST",
    body: JSON.stringify(params),
  });
}

// ---- Stripe Connect (organisateur) ----

export async function stripeOnboardingLink(): Promise<string> {
  const { url } = await api<{ url: string }>("/stripe/connect/onboard", {
    method: "POST",
  });
  return url;
}

export async function stripeStatus(): Promise<{
  connected: boolean;
  ready: boolean;
}> {
  return api("/stripe/connect/status");
}
