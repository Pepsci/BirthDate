import { api } from "./api";

export interface FriendUser {
  _id: string;
  name: string;
  surname?: string;
  email?: string;
  avatar?: string | null;
  birthDate?: string | null;
}

export interface FriendEntry {
  friendship: { _id: string; status: string };
  friendUser: FriendUser;
  linkedDate?: { _id: string } | null;
}

export interface FriendRequest {
  _id: string;
  user: FriendUser; // le demandeur
  requestedBy?: FriendUser;
  status: string;
}

export interface SentItems {
  requests: { _id: string; friend: FriendUser }[];
  invitations: { _id: string; email: string; createdAt: string }[];
}

export async function fetchFriends(): Promise<FriendEntry[]> {
  return api<FriendEntry[]>("/friends");
}

export async function fetchFriendRequests(): Promise<FriendRequest[]> {
  return api<FriendRequest[]>("/friends/requests");
}

export async function fetchSent(): Promise<SentItems> {
  return api<SentItems>("/friends/sent");
}

/** Demande d'ami (user inscrit) ou invitation email (externe) */
export async function addFriend(email: string): Promise<{ message?: string }> {
  return api<{ message?: string }>("/friends", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

/**
 * Demande d'ami à partir de l'_id du compte (carte partagée dans le chat).
 * L'email de la personne n'est jamais transmis au demandeur.
 */
export async function addFriendById(
  userId: string,
): Promise<{ message?: string }> {
  return api<{ message?: string }>("/friends/request-by-id", {
    method: "POST",
    body: JSON.stringify({ userId }),
  });
}

export async function acceptRequest(friendshipId: string): Promise<void> {
  await api(`/friends/${friendshipId}/accept`, { method: "PATCH" });
}

export async function rejectRequest(friendshipId: string): Promise<void> {
  await api(`/friends/${friendshipId}/reject`, { method: "PATCH" });
}

export async function removeFriend(friendshipId: string): Promise<void> {
  await api(`/friends/${friendshipId}`, { method: "DELETE" });
}

/**
 * Annule une demande d'ami qu'on a soi-même envoyée et qui est encore en
 * attente. Même route que `removeFriend` : le backend autorise les deux
 * participants de la relation à la supprimer, quel que soit son statut.
 */
export async function cancelSentRequest(friendshipId: string): Promise<void> {
  await api(`/friends/${friendshipId}`, { method: "DELETE" });
}

/** Annule une invitation email envoyée à une personne non inscrite. */
export async function cancelInvitation(invitationId: string): Promise<void> {
  await api(`/friends/invitations/${invitationId}`, { method: "DELETE" });
}

export interface FriendCardSummary {
  _id: string;
  dateId: string | null;
  name: string;
  surname?: string;
  avatar?: string | null;
  birthDate?: string | null;
  nameday?: string | null;
  wishlistCount: number;
  sharedGiftList: { _id: string; label?: string; giftCount: number } | null;
}

/** Résumé pour la carte glissante (chat) : âge, anniversaire, idées cadeaux. */
export async function fetchFriendCardSummary(
  friendId: string,
): Promise<FriendCardSummary> {
  return api<FriendCardSummary>(`/friends/${friendId}/card-summary`);
}
