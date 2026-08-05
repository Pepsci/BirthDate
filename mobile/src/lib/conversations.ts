import { api } from "./api";

export interface Conversation {
  _id: string;
  participants: {
    _id: string;
    name: string;
    surname?: string;
    avatar?: string;
  }[];
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

/**
 * « Supprimer pour moi » : le serveur horodate mon effacement, il ne détruit
 * rien. L'autre participant garde son historique — un utilisateur ne doit pas
 * pouvoir effacer les preuves chez quelqu'un d'autre.
 */
export async function deleteConversation(
  conversationId: string,
): Promise<void> {
  await api(`/conversations/${conversationId}`, { method: "DELETE" });
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
  /** Empreinte laissée quand le compte de l'expéditeur a été purgé. */
  senderSnapshot?: { name?: string; publicKey?: string } | null;
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
    // type "date_share" : la carte anniversaire elle-même, sans aucun cadeau.
    name?: string;
    surname?: string;
    birthDate?: string; // ISO
    nameday?: string | null; // "MM-DD"
    linkedUserId?: string | null; // compte de la personne, si elle est inscrite
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
