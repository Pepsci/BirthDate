import { getLocaleTag, t } from "@/i18n";
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
  | "event_cancelled"
  | "event_uncancelled"
  | "event_transfer_offer"
  | "event_transfer_accepted"
  | "event_transfer_declined"
  | "event_transfer_done"
  | "event_pool_refunded"
  | "shared_gift_invite"
  | "shared_gift_accepted"
  | "shared_gift_added"
  | "shared_gift_proposed"
  | "shared_gift_proposal_accepted"
  | "shared_gift_proposal_declined"
  | "shared_gift_updated"
  | "shared_gift_removed"
  | "shared_gift_member_left"
  | "shared_gift_shared"
  | "message_reaction"
  | "support_reply";

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

/**
 * Éteint les notifications portant sur une conversation qu'on vient d'ouvrir.
 *
 * ⚠️ Personne ne lit ses messages depuis le centre de notifications : on ouvre
 * l'app, on va dans le chat, on lit. Sans ça la pastille reste rouge pour un
 * message déjà lu : et un compteur qui ment finit par ne plus être regardé.
 *
 * Jamais bloquant : c'est du confort d'affichage, pas une action de
 * l'utilisateur. Un échec réseau ne doit pas remonter dans l'écran de chat.
 */
export async function markConversationNotifsRead(
  kind: "dm" | "event",
  id: string,
): Promise<void> {
  try {
    await api("/notifications/read-conversation", {
      method: "PATCH",
      body: JSON.stringify({ kind, id }),
    });
  } catch {
    /* silencieux */
  }
}

export async function deleteNotification(id: string): Promise<void> {
  await api(`/notifications/${id}`, { method: "DELETE" });
}

export async function deleteAllNotifications(): Promise<void> {
  await api("/notifications", { method: "DELETE" });
}

/*
 * Repli emoji pour la liste des notifications.
 *
 * ⚠️ Le centre de notifications est une liste de texte : chaque ligne porte un
 * emoji, pas un composant. Y injecter le dessin maison demanderait de refaire
 * le rendu de toute la liste pour un seul type : l'emoji reste ici, le dessin
 * maison reste dans le fil de discussion, là où on le regarde.
 */
const REACTION_EMOJI: Record<string, string> = {
  like: "👍",
  love: "❤️",
  laugh: "😂",
  wow: "😮",
  sad: "😢",
  party: "🎉",
};

/** Emoji + texte lisible pour chaque type (mêmes données que le web) */
export function notifDisplay(n: AppNotification): {
  emoji: string;
  text: string;
} {
  const d = n.data ?? {};
  const who =
    d.guestName ??
    d.senderName ??
    d.reactorName ??
    d.name ??
    d.organizerName ??
    t("welcome:someone");
  switch (n.type) {
    case "friend_request":
      return { emoji: "👥", text: t("notifs:friendRequest", { who }) };
    case "friend_accepted":
      return { emoji: "🤝", text: t("notifs:friendAccepted", { who }) };
    case "new_message":
      return { emoji: "💬", text: t("notifs:newMessage", { who }) };
    case "birthday_soon":
      return {
        emoji: "🎂",
        text: d.name
          ? d.daysLeft === 0
            ? t("notifs:birthdayToday", { name: d.name })
            : t("notifs:birthdaySoon", { name: d.name })
          : t("notifs:birthdaySoonAnon"),
      };
    case "nameday_soon":
      return {
        emoji: "🌸",
        text: d.name
          ? d.daysLeft === 0
            ? t("notifs:namedayToday", { name: d.name })
            : t("notifs:namedaySoon", { name: d.name })
          : t("notifs:namedaySoonAnon"),
      };
    case "gift_reserved":
      return {
        emoji: "🎁",
        text: d.giftName
          ? t("notifs:giftReserved", { gift: d.giftName })
          : t("notifs:giftReservedAnon"),
      };
    case "event_reminder":
      return {
        emoji: "🎉",
        // `data.message` est posé par le serveur quand la notif n'est pas un
        // simple rappel, sans ça on affichait « Rappel : … » sur des
        // notifications de modification. On le respecte comme le fait le web.
        // Ces notifs-là datent d'avant les types dédiés ci-dessous : on garde
        // le rendu pour celles déjà en base.
        text: d.message
          ? `${d.message}${d.eventTitle ? ` « ${d.eventTitle} »` : ""}`
          : d.eventTitle
            ? d.organizerName ? t("notifs:eventInvite", { who: d.organizerName, title: d.eventTitle }) : t("notifs:eventReminderTitle", { title: d.eventTitle })
            : t("notifs:eventReminder"),
      };
    case "event_cancelled":
      return {
        emoji: "❌",
        // Le motif, quand il y en a un, EST l'information : « X est annulé »
        // sans raison laisse la question ouverte et pousse à rouvrir la page.
        text: d.reason
          ? t("notifs:eventCancelledReason", { title: d.eventTitle ?? t("notifs:anEventCap"), reason: d.reason })
          : t("notifs:eventCancelled", { title: d.eventTitle ?? t("notifs:anEventCap") }),
      };
    case "event_uncancelled":
      return {
        emoji: "✅",
        text: t("notifs:eventUncancelled", { title: d.eventTitle ?? t("notifs:anEventCap") }),
      };
    case "event_transfer_offer":
      return {
        emoji: "🤝",
        text: t("notifs:transferOffer", { who: d.fromName ?? t("events:theHost"), title: d.eventTitle ?? t("notifs:anEvent") }),
      };
    case "event_transfer_accepted":
      return {
        emoji: "🤝",
        text: t("notifs:transferAccepted", { who: d.fromName ?? t("notifs:aParticipant"), title: d.eventTitle ?? t("notifs:anEvent") }),
      };
    case "event_transfer_declined":
      return {
        emoji: "↩️",
        text: t("notifs:transferDeclined", { who: d.fromName ?? t("notifs:theParticipant"), title: d.eventTitle ?? t("notifs:anEvent") }),
      };
    case "event_transfer_done":
      return {
        emoji: "🤝",
        // Le serveur compose le message : il est le seul à savoir s'il faut y
        // ajouter la phrase sur l'argent déjà versé, qui ne suit pas le
        // transfert.
        text:
          d.message ??
          t("notifs:transferDone", { title: d.eventTitle ?? t("notifs:anEvent") }),
      };
    case "event_pool_refunded":
      return {
        emoji: "💸",
        text: d.amount
          ? t("notifs:poolRefundedAmount", { amount: (Number(d.amount) / 100).toFixed(2), title: d.eventTitle ?? t("notifs:anEvent") })
          : t("notifs:poolRefunded", { title: d.eventTitle ?? t("notifs:anEvent") }),
      };
    case "event_updated":
      return {
        emoji: "✏️",
        text: t("notifs:eventUpdated", { title: d.eventTitle ?? t("notifs:anEvent") }),
      };
    case "event_date_changed":
      return {
        emoji: "📅",
        text: d.newDateLabel
          ? t("notifs:dateChangedLabel", { title: d.eventTitle ?? t("notifs:event"), date: d.newDateLabel })
          : t("notifs:dateChanged", { title: d.eventTitle ?? t("notifs:event") }),
      };
    case "event_rsvp":
      return {
        emoji: "✅",
        text: t("notifs:rsvp", { who, title: d.eventTitle ?? t("notifs:yourEvent") }),
      };
    case "event_date_vote":
      return {
        emoji: "📅",
        text: t("notifs:dateVote", { who, title: d.eventTitle ?? t("notifs:anEvent") }),
      };
    case "event_location_vote":
      return {
        emoji: "📍",
        text: t("notifs:locationVote", { who, title: d.eventTitle ?? t("notifs:anEvent") }),
      };
    case "event_gift_proposed":
      return {
        emoji: "🎁",
        text: t("notifs:giftProposed", { who: d.proposerName ?? who, gift: d.giftName ?? t("notifs:aGift") }),
      };
    case "event_gift_vote":
      return {
        emoji: "❤️",
        text: t("notifs:giftVote", { who, title: d.eventTitle ?? t("notifs:anEvent") }),
      };
    case "event_chat_message":
      return {
        emoji: "💬",
        text: t("notifs:eventChat", { title: d.eventTitle ?? t("notifs:anEvent") }),
      };
    case "event_pool_contribution":
      return {
        emoji: "💝",
        text: d.eventTitle ? t("notifs:poolContributionOf", { who, title: d.eventTitle }) : t("notifs:poolContribution", { who }),
      };
    case "shared_gift_invite":
      return {
        emoji: "👥",
        text: d.personName ? t("notifs:sharedInviteFor", { who: d.fromName ?? who, person: d.personName }) : t("notifs:sharedInvite", { who: d.fromName ?? who }),
      };
    case "shared_gift_accepted":
      return {
        emoji: "🎁",
        text: `${t("notifs:sharedAccepted", { who: d.fromName ?? who })}${d.personName ? ` · ${d.personName}` : ""}`,
      };
    // ── Activité dans une liste commune ──────────────────────────────────
    // `listLabel` est optionnel : la liste n'est pas toujours nommée.
    case "shared_gift_added":
      return {
        emoji: "🎁",
        text: d.listLabel ? t("notifs:sharedAddedTo", { who: d.fromName ?? who, gift: d.giftName ?? t("notifs:anIdea"), list: d.listLabel }) : t("notifs:sharedAdded", { who: d.fromName ?? who, gift: d.giftName ?? t("notifs:anIdea") }),
      };
    // ── Propositions d'idées par un invité ───────────────────────────────
    case "shared_gift_proposed":
      return {
        emoji: "💡",
        text: d.listLabel ? t("notifs:sharedProposedTo", { who: d.fromName ?? who, gift: d.giftName ?? t("notifs:anIdea"), list: d.listLabel }) : t("notifs:sharedProposed", { who: d.fromName ?? who, gift: d.giftName ?? t("notifs:anIdea") }),
      };
    case "shared_gift_proposal_accepted":
      return {
        emoji: "🎁",
        text: t("notifs:sharedProposalAccepted", { who: d.fromName ?? who, gift: d.giftName ?? t("notifs:anIdea") }),
      };
    case "shared_gift_proposal_declined":
      return {
        emoji: "↩️",
        text: t("notifs:sharedProposalDeclined", { who: d.fromName ?? who, gift: d.giftName ?? t("notifs:anIdea") }),
      };
    case "shared_gift_updated":
      return {
        emoji: "✏️",
        text: d.statusLabel
          ? `${d.fromName ?? who} ${d.statusLabel} : « ${d.giftName ?? t("notifs:anIdea")} »`
          : d.listLabel ? t("notifs:sharedUpdatedIn", { who: d.fromName ?? who, gift: d.giftName ?? t("notifs:anIdea"), list: d.listLabel }) : t("notifs:sharedUpdated", { who: d.fromName ?? who, gift: d.giftName ?? t("notifs:anIdea") }),
      };
    case "shared_gift_removed":
      return {
        emoji: "🗑️",
        text: d.listLabel ? t("notifs:sharedRemovedFrom", { who: d.fromName ?? who, gift: d.giftName ?? t("notifs:anIdea"), list: d.listLabel }) : t("notifs:sharedRemoved", { who: d.fromName ?? who, gift: d.giftName ?? t("notifs:anIdea") }),
      };
    case "shared_gift_shared":
      return {
        emoji: "🎁",
        text: `${t("notifs:sharedShared", { who: d.fromName ?? who })}${d.listLabel ? ` · ${d.listLabel}` : ""}`,
      };
    case "shared_gift_member_left":
      return {
        emoji: "👋",
        text: `${t("notifs:sharedLeft", { who: d.fromName ?? who })}${d.listLabel ? ` · ${d.listLabel}` : ""}`,
      };
    case "message_reaction":
      return {
        emoji: REACTION_EMOJI[d.reaction as string] ?? "🙂",
        text: d.eventTitle
          ? t("notifs:reactionIn", { who, title: d.eventTitle })
          : t("notifs:reaction", { who }),
      };
    case "support_reply":
      return {
        emoji: "💬",
        text: d.subject
          ? t("notifs:supportReplySubject", { subject: d.subject })
          : t("notifs:supportReply"),
      };
    default:
      return { emoji: "🔔", text: t("notifs:generic") };
  }
}

/** "il y a 3 min", "hier", "12 juin" */
export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return t("notifs:ago.now");
  if (min < 60) return t("notifs:ago.min", { count: min });
  const h = Math.floor(min / 60);
  if (h < 24) return t("notifs:ago.h", { count: h });
  const days = Math.floor(h / 24);
  if (days === 1) return t("notifs:ago.yesterday");
  if (days < 7) return t("notifs:ago.d", { count: days });
  return new Date(iso).toLocaleDateString(getLocaleTag(), {
    day: "numeric",
    month: "short",
  });
}
