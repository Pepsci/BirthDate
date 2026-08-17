import { api } from "./api";

export type NotifType =
  | "friend_request"
  | "friend_accepted"
  | "new_message"
  | "birthday_soon"
  | "nameday_soon"
  | "gift_reserved"
  | "event_reminder"
  | "event_updated"
  | "event_date_changed"
  | "event_rsvp"
  | "event_date_vote"
  | "event_location_vote"
  | "event_gift_proposed"
  | "event_gift_vote"
  | "event_chat_message"
  | "event_pool_contribution"
  | "shared_gift_invite"
  | "shared_gift_accepted"
  | "shared_gift_added"
  | "shared_gift_updated"
  | "shared_gift_removed"
  | "shared_gift_member_left";

export interface AppNotification {
  _id: string;
  type: NotifType;
  data: Record<string, any>;
  link: string | null;
  read: boolean;
  createdAt: string;
}

export async function fetchNotifications(): Promise<{
  notifications: AppNotification[];
  unreadCount: number;
}> {
  return api("/notifications?limit=50");
}

export async function markNotificationRead(id: string): Promise<void> {
  await api(`/notifications/${id}/read`, { method: "PATCH" });
}

export async function markAllNotificationsRead(): Promise<void> {
  await api("/notifications/read-all", { method: "PATCH" });
}

export async function deleteNotification(id: string): Promise<void> {
  await api(`/notifications/${id}`, { method: "DELETE" });
}

export async function deleteAllNotifications(): Promise<void> {
  await api("/notifications", { method: "DELETE" });
}

/** Emoji + texte lisible pour chaque type (mêmes données que le web) */
export function notifDisplay(n: AppNotification): {
  emoji: string;
  text: string;
} {
  const d = n.data ?? {};
  const who = d.guestName ?? d.senderName ?? d.name ?? d.organizerName ?? "Quelqu'un";
  switch (n.type) {
    case "friend_request":
      return { emoji: "👥", text: `${who} t'a envoyé une demande d'ami` };
    case "friend_accepted":
      return { emoji: "🤝", text: `${who} a accepté ta demande d'ami` };
    case "new_message":
      return { emoji: "💬", text: `Nouveau message de ${who}` };
    case "birthday_soon":
      return {
        emoji: "🎂",
        text: d.name
          ? `L'anniversaire de ${d.name} approche !`
          : "Un anniversaire approche !",
      };
    case "nameday_soon":
      return {
        emoji: "🌸",
        text: d.name
          ? d.daysLeft === 0
            ? `C'est la fête de ${d.name} aujourd'hui !`
            : `C'est bientôt la fête de ${d.name} !`
          : "Une fête approche !",
      };
    case "gift_reserved":
      return {
        emoji: "🎁",
        text: d.giftName
          ? `« ${d.giftName} » a été réservé sur ta wishlist`
          : "Un cadeau de ta wishlist a été réservé",
      };
    case "event_reminder":
      return {
        emoji: "🎉",
        // `data.message` est posé par le serveur quand la notif n'est pas un
        // simple rappel — sans ça on affichait « Rappel : … » sur des
        // notifications de modification. On le respecte comme le fait le web.
        // Ces notifs-là datent d'avant les types dédiés ci-dessous : on garde
        // le rendu pour celles déjà en base.
        text: d.message
          ? `${d.message}${d.eventTitle ? ` « ${d.eventTitle} »` : ""}`
          : d.eventTitle
            ? `${d.organizerName ? `${d.organizerName} t'invite à` : "Rappel :"} « ${d.eventTitle} »`
            : "Rappel d'événement",
      };
    case "event_updated":
      return {
        emoji: "✏️",
        text: `L'organisateur a modifié « ${d.eventTitle ?? "un événement"} »`,
      };
    case "event_date_changed":
      return {
        emoji: "📅",
        text: d.newDateLabel
          ? `Nouvelle date pour « ${d.eventTitle ?? "événement"} » : ${d.newDateLabel} — confirme ta présence`
          : `La date de « ${d.eventTitle ?? "événement"} » a changé — confirme ta présence`,
      };
    case "event_rsvp":
      return {
        emoji: "✅",
        text: `${who} a répondu à « ${d.eventTitle ?? "ton événement"} »`,
      };
    case "event_date_vote":
      return {
        emoji: "📅",
        text: `${who} a voté pour une date dans « ${d.eventTitle ?? "un événement"} »`,
      };
    case "event_location_vote":
      return {
        emoji: "📍",
        text: `${who} a voté pour un lieu dans « ${d.eventTitle ?? "un événement"} »`,
      };
    case "event_gift_proposed":
      return {
        emoji: "🎁",
        text: `${d.proposerName ?? who} propose « ${d.giftName ?? "un cadeau"} »`,
      };
    case "event_gift_vote":
      return {
        emoji: "❤️",
        text: `${who} a voté pour un cadeau dans « ${d.eventTitle ?? "un événement"} »`,
      };
    case "event_chat_message":
      return {
        emoji: "💬",
        text: `Nouveaux messages dans « ${d.eventTitle ?? "un événement"} »`,
      };
    case "event_pool_contribution":
      return {
        emoji: "💝",
        text: `${who} a contribué à la cagnotte${d.eventTitle ? ` de « ${d.eventTitle} »` : ""}`,
      };
    case "shared_gift_invite":
      return {
        emoji: "👥",
        text: `${d.fromName ?? who} veut créer une liste de cadeaux commune${d.personName ? ` pour ${d.personName}` : ""}`,
      };
    case "shared_gift_accepted":
      return {
        emoji: "🎁",
        text: `${d.fromName ?? who} a rejoint votre liste de cadeaux commune${d.personName ? ` — ${d.personName}` : ""}`,
      };
    // ── Activité dans une liste commune ──────────────────────────────────
    // `listLabel` est optionnel : la liste n'est pas toujours nommée.
    case "shared_gift_added":
      return {
        emoji: "🎁",
        text: `${d.fromName ?? who} a ajouté « ${d.giftName ?? "une idée"} »${d.listLabel ? ` à ${d.listLabel}` : " à votre liste commune"}`,
      };
    case "shared_gift_updated":
      return {
        emoji: "✏️",
        text: d.statusLabel
          ? `${d.fromName ?? who} ${d.statusLabel} : « ${d.giftName ?? "une idée"} »`
          : `${d.fromName ?? who} a modifié « ${d.giftName ?? "une idée"} »${d.listLabel ? ` dans ${d.listLabel}` : ""}`,
      };
    case "shared_gift_removed":
      return {
        emoji: "🗑️",
        text: `${d.fromName ?? who} a retiré « ${d.giftName ?? "une idée"} »${d.listLabel ? ` de ${d.listLabel}` : " de votre liste commune"}`,
      };
    case "shared_gift_member_left":
      return {
        emoji: "👋",
        text: `${d.fromName ?? who} a quitté votre liste de cadeaux commune${d.listLabel ? ` — ${d.listLabel}` : ""}`,
      };
    default:
      return { emoji: "🔔", text: "Nouvelle notification" };
  }
}

/** "il y a 3 min", "hier", "12 juin" */
export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `il y a ${h} h`;
  const days = Math.floor(h / 24);
  if (days === 1) return "hier";
  if (days < 7) return `il y a ${days} j`;
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
  });
}
