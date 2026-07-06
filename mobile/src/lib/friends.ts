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
  invitations: { email: string; createdAt: string }[];
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

export async function acceptRequest(friendshipId: string): Promise<void> {
  await api(`/friends/${friendshipId}/accept`, { method: "PATCH" });
}

export async function rejectRequest(friendshipId: string): Promise<void> {
  await api(`/friends/${friendshipId}/reject`, { method: "PATCH" });
}

export async function removeFriend(friendshipId: string): Promise<void> {
  await api(`/friends/${friendshipId}`, { method: "DELETE" });
}
