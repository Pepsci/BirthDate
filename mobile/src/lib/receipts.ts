/**
 * Accusés de réception d'un message privé — miroir de
 * front/src/components/chat/receipts.js. Voir server/utils/messageReceipts.js.
 *
 * `readBy` contient aussi l'expéditeur (posé à l'envoi) : on ne compte que les
 * entrées des AUTRES participants.
 */
import type { DMMessage } from "./conversations";

export type ReceiptStatus = "sent" | "delivered" | "read";
export type ReceiptField = "readBy" | "deliveredTo";

type Entry = { user: string | { _id: string }; readAt?: string; deliveredAt?: string };

const idOf = (u: Entry["user"] | undefined | null) =>
  String(typeof u === "object" && u !== null ? u._id : u);

function otherEntry(
  list: Entry[] | undefined,
  message: DMMessage,
  myUserId: string | null,
): Entry | null {
  const senderId = message.sender?._id ?? null;
  return (
    (list ?? []).find((r) => {
      const id = idOf(r.user);
      return id !== String(myUserId) && id !== String(senderId);
    }) ?? null
  );
}

export function getReceiptStatus(
  message: DMMessage,
  myUserId: string | null,
): ReceiptStatus {
  if (otherEntry(message.readBy, message, myUserId)) return "read";
  if (otherEntry(message.deliveredTo, message, myUserId)) return "delivered";
  return "sent";
}

/** Distribué retombe sur Lu : un message lu a forcément été distribué. */
export function getReceiptTimes(message: DMMessage, myUserId: string | null) {
  const read = otherEntry(message.readBy, message, myUserId);
  const delivered = otherEntry(message.deliveredTo, message, myUserId);
  return {
    sentAt: message.createdAt,
    deliveredAt: delivered?.deliveredAt ?? read?.readAt ?? null,
    readAt: read?.readAt ?? null,
  };
}

/** Applique un accusé reçu par socket à la liste locale. */
export function applyReceipt(
  messages: DMMessage[],
  payload: { userId: string; at?: string },
  field: ReceiptField,
  myUserId: string | null,
): DMMessage[] {
  const stamp = payload.at ?? new Date().toISOString();
  const stampKey = field === "readBy" ? "readAt" : "deliveredAt";
  return messages.map((m) => {
    if (m.sender?._id !== myUserId) return m;
    const list = (m[field] ?? []) as Entry[];
    if (list.some((r) => idOf(r.user) === String(payload.userId))) return m;
    return { ...m, [field]: [...list, { user: payload.userId, [stampKey]: stamp }] };
  });
}

export function formatReceiptDate(date: string | null): string {
  if (!date) return "—";
  return new Date(date).toLocaleString("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
