import { api } from "./api";

export type NotifType =
  | "friend_request"
  | "friend_accepted"
  | "new_message"
  | "birthday_soon"
  | "gift_reserved"
  | "event_reminder"
  | "event_rsvp"
  | "event_date_vote"
  | "event_location_vote"
  | "event_gift_proposed"
  | "event_gift_vote"
  | "event_chat_message"
  | "event_pool_contribution";

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
        text: d.eventTitle
          ? `${d.organizerName ? `${d.organizerName} t'invite à` : "Rappel :"} « ${d.eventTitle} »`
          : "Rappel d'événement",
      };
    case "event_rsvp":
      return {
        emoji: "✅",
        text: `${who} a répondu à « ${d.eventTitle ?? "ton événement"} »`,
      };
    case "event_date_vote":
      return {
        emoji: "📅",
        text: `${who} a voté pour une date — « ${d.eventTitle ?? "événement"} »`,
      };
    case "event_location_vote":
      return {
        emoji: "📍",
        text: `${who} a voté pour un lieu — « ${d.eventTitle ?? "événement"} »`,
      };
    case "event_gift_proposed":
      return {
        emoji: "🎁",
        text: `${d.proposerName ?? who} propose « ${d.giftName ?? "un cadeau"} »`,
      };
    case "event_gift_vote":
      return {
        emoji: "❤️",
        text: `${who} a voté pour un cadeau — « ${d.eventTitle ?? "événement"} »`,
      };
    case "event_chat_message":
      return {
        emoji: "💬",
        text: `Nouveaux messages — « ${d.eventTitle ?? "événement"} »`,
      };
    case "event_pool_contribution":
      return {
        emoji: "💝",
        text: `${who} a contribué à la cagnotte${d.eventTitle ? ` — « ${d.eventTitle} »` : ""}`,
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
