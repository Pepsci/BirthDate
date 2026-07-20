import { api } from "./api";
import { Gift } from "./dates";

export interface SharedGift extends Gift {
  addedBy?: { _id: string; name: string; surname?: string } | null;
}

export interface SharedMember {
  _id: string;
  name: string;
  surname?: string;
  avatar?: string | null;
}

export interface SharedGiftList {
  _id: string;
  label?: string | null;
  members: SharedMember[];
  gifts: SharedGift[];
  createdBy?: string;
}

export interface SharedInvitation {
  _id: string;
  fromUser: { _id: string; name: string; surname?: string; avatar?: string };
  fromDate: { _id: string; name: string; surname?: string };
  label?: string | null;
  status: string;
  createdAt: string;
}

export async function inviteSharedList(
  friendId: string,
  dateId: string,
  options?: { mode?: "full" | "selective"; giftIds?: string[] },
): Promise<void> {
  await api("/shared-gifts/invite", {
    method: "POST",
    body: JSON.stringify({
      friendId,
      dateId,
      mode: options?.mode ?? "full",
      giftIds: options?.giftIds ?? [],
    }),
  });
}

export async function fetchSharedInvitations(): Promise<SharedInvitation[]> {
  return api<SharedInvitation[]>("/shared-gifts/invitations");
}

export interface SentInvitation {
  _id: string;
  toUser: { _id: string; name: string; surname?: string };
  fromDate: { _id: string; name: string; surname?: string };
  status: string;
}

export async function fetchSentSharedInvitations(
  dateId?: string,
): Promise<SentInvitation[]> {
  const q = dateId ? `?dateId=${dateId}` : "";
  return api<SentInvitation[]>(`/shared-gifts/sent${q}`);
}

export async function cancelSharedInvitation(id: string): Promise<void> {
  await api(`/shared-gifts/invitations/${id}/cancel`, { method: "POST" });
}

export async function acceptSharedInvitation(
  id: string,
  dateId: string,
): Promise<{ sharedGiftList: string }> {
  return api(`/shared-gifts/invitations/${id}/accept`, {
    method: "POST",
    body: JSON.stringify({ dateId }),
  });
}

export async function declineSharedInvitation(id: string): Promise<void> {
  await api(`/shared-gifts/invitations/${id}/decline`, { method: "POST" });
}

export async function fetchSharedList(id: string): Promise<SharedGiftList> {
  return api<SharedGiftList>(`/shared-gifts/${id}`);
}

export async function addSharedGift(
  listId: string,
  gift: {
    giftName: string;
    occasion?: string;
    year?: number;
    url?: string;
    price?: number;
    image?: string;
    status?: string;
  },
): Promise<SharedGiftList> {
  return api(`/shared-gifts/${listId}/gifts`, {
    method: "POST",
    body: JSON.stringify(gift),
  });
}

export async function updateSharedGift(
  listId: string,
  giftId: string,
  fields: Partial<SharedGift>,
): Promise<SharedGiftList> {
  return api(`/shared-gifts/${listId}/gifts/${giftId}`, {
    method: "PATCH",
    body: JSON.stringify(fields),
  });
}

export async function deleteSharedGift(
  listId: string,
  giftId: string,
): Promise<SharedGiftList> {
  return api(`/shared-gifts/${listId}/gifts/${giftId}`, { method: "DELETE" });
}

export async function leaveSharedList(listId: string): Promise<void> {
  await api(`/shared-gifts/${listId}/leave`, { method: "POST" });
}
