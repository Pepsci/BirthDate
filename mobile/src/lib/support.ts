import { api } from "./api";

/** Envoie un message au support (→ support@birthreminder.com). */
export async function sendSupportMessage(
  subject: string,
  message: string,
  /**
   * Cagnotte concernée, pour un litige de participation.
   *
   * ⚠️ Deux effets côté serveur : le ticket est rattaché à l'événement (l'admin
   * ouvre directement les contributions au lieu de deviner), et il échappe à la
   * règle du ticket unique : un litige d'argent ne doit pas être bloqué par une
   * question en cours sur autre chose. Le plafond devient un ticket ouvert par
   * cagnotte.
   */
  eventShortId?: string,
  /**
   * ⚠️ Indépendant de `eventShortId`, et c'est essentiel : une contribution
   * dont l'événement a été supprimé n'a plus d'identifiant. Si la catégorie
   * dépendait de l'événement, ces demandes repartiraient en « général » et se
   * feraient refuser au profit d'une conversation en cours sur autre chose.
   */
  category?: "pool",
): Promise<void> {
  await api("/support", {
    method: "POST",
    body: JSON.stringify({ subject, message, eventShortId, category }),
  });
}

/**
 * Signale une fête incorrecte (ou manquante) pour un prénom.
 *
 * Le serveur construit lui-même le ticket (catégorie "nameday") avec la date
 * que donne le calendrier aujourd'hui : l'admin voit « Mia : 29 septembre →
 * proposé 15 août » et ouvre le prénom dans l'onglet Fêtes en un clic.
 * Pas bloqué par une conversation en cours sur un autre sujet ; un seul
 * signalement ouvert par prénom (409 sinon).
 */
export async function reportNameday(
  name: string,
  expectedDate: string | null,
  comment: string,
): Promise<void> {
  await api("/support", {
    method: "POST",
    body: JSON.stringify({
      category: "nameday",
      namedayReport: { name, expectedDate },
      message: comment,
    }),
  });
}

// ── Conversations avec le support ─────────────────────────────────────────
// Même API que l'onglet Support du web (front/…/chat/SupportThread.jsx).

export type SupportStatus = "open" | "answered" | "closed";

export interface SupportMessage {
  _id: string;
  sender: "user" | "admin";
  body: string;
  createdAt: string;
}

export interface SupportTicket {
  _id: string;
  subject: string;
  category: "general" | "pool" | "nameday";
  status: SupportStatus;
  messages: SupportMessage[];
  lastMessageAt: string;
  /** Réponse de l'équipe pas encore lue par l'utilisateur */
  unreadUser: boolean;
}

/** Les 20 derniers tickets. Ne marque rien comme lu (sert aux badges). */
export async function fetchMyTickets(): Promise<SupportTicket[]> {
  const res = await api<{ tickets: SupportTicket[] }>("/support/mine");
  return res.tickets ?? [];
}

/** Un ticket complet ; le marque comme lu côté utilisateur. */
export async function fetchTicket(id: string): Promise<SupportTicket> {
  const res = await api<{ ticket: SupportTicket }>(`/support/mine/${id}`);
  return res.ticket;
}

/**
 * Répond dans un fil existant. Un ticket fermé refuse la réponse (409) :
 * il faut ouvrir un nouveau sujet : règle serveur, l'écran grise la saisie.
 */
export async function replyToTicket(
  id: string,
  message: string,
): Promise<SupportTicket> {
  const res = await api<{ ticket: SupportTicket }>(
    `/support/mine/${id}/reply`,
    { method: "POST", body: JSON.stringify({ message }) },
  );
  return res.ticket;
}
