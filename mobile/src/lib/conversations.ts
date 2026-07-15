import { api } from "./api";

export interface Conversation {
  _id: string;
  participants: { _id: string; name: string; surname?: string }[];
}

export interface ConversationSummary extends Conversation {
  unreadCount: number;
  lastMessage?: {
    content: string;
    isEncrypted?: boolean;
    sender?: { _id: string; name?: string } | null;
    createdAt?: string;
  } | null;
  lastMessageAt?: string | null;
}

/** Toutes mes conversations avec compteur de non-lus */
export async function fetchConversations(): Promise<ConversationSummary[]> {
  return api<ConversationSummary[]>("/conversations");
}

export interface DMMessage {
  _id: string;
  content: string;
  sender: {
    _id: string;
    name: string;
    surname?: string;
    publicKey?: string | null;
  } | null;
  createdAt: string;
  isEncrypted?: boolean;
  encryptedFor?: Record<string, string>;
  replyTo?: string | null;
  edited?: boolean;
  editedAt?: string;
  type?: string;
  metadata?: {
    personName?: string;
    personId?: string;
    gifts?: {
      giftName: string;
      occasion?: string;
      year?: number;
      purchased?: boolean;
    }[];
  } | null;
}

/** Trouve ou crée la conversation avec un ami (403 si pas amis) */
export async function startConversation(
  friendId: string,
): Promise<Conversation> {
  return api<Conversation>("/conversations/start", {
    method: "POST",
    body: JSON.stringify({ friendId }),
  });
}

export async function fetchDMMessages(
  conversationId: string,
): Promise<DMMessage[]> {
  return api<DMMessage[]>(`/conversations/${conversationId}/messages`);
}

export async function markConversationRead(
  conversationId: string,
): Promise<void> {
  await api(`/conversations/${conversationId}/read`, { method: "PUT" });
}

export async function fetchUserPublicKey(
  userId: string,
): Promise<string | null> {
  const { publicKey } = await api<{ publicKey: string | null }>(
    `/users/${userId}/publicKey`,
  );
  return publicKey ?? null;
}
