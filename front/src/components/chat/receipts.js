/**
 * Accusés de réception d'un message privé : lecture des champs serveur
 * `deliveredTo` et `readBy` (voir server/utils/messageReceipts.js).
 *
 * `readBy` contient aussi l'expéditeur lui-même (posé à l'envoi) : on ne
 * compte donc que les entrées des AUTRES participants.
 */

const idOf = (user) => String(user?._id ?? user);

const otherEntry = (list, message, myUserId) =>
  (list || []).find((r) => {
    const id = idOf(r.user);
    return id !== String(myUserId) && id !== idOf(message.sender);
  }) || null;

/** "sending" | "failed" | "sent" | "delivered" | "read" */
export function getReceiptStatus(message, myUserId) {
  if (message.status === "sending" || message.status === "failed") {
    return message.status;
  }
  if (otherEntry(message.readBy, message, myUserId)) return "read";
  if (otherEntry(message.deliveredTo, message, myUserId)) return "delivered";
  return "sent";
}

/** Horodatages pour la fenêtre « Infos message ». Distribué retombe sur Lu. */
export function getReceiptTimes(message, myUserId) {
  const read = otherEntry(message.readBy, message, myUserId);
  const delivered = otherEntry(message.deliveredTo, message, myUserId);
  return {
    sentAt: message.createdAt,
    deliveredAt: delivered?.deliveredAt ?? read?.readAt ?? null,
    readAt: read?.readAt ?? null,
  };
}

/**
 * Applique un accusé reçu par socket à la liste locale.
 * @param {"readBy"|"deliveredTo"} field
 */
export function applyReceipt(messages, { userId, at }, field, myUserId) {
  const stampKey = field === "readBy" ? "readAt" : "deliveredAt";
  const stamp = at || new Date().toISOString();
  return messages.map((msg) => {
    if (idOf(msg.sender) !== String(myUserId)) return msg;
    if (msg.status === "sending" || msg.status === "failed") return msg;
    const list = msg[field] || [];
    if (list.some((r) => idOf(r.user) === String(userId))) return msg;
    return { ...msg, [field]: [...list, { user: userId, [stampKey]: stamp }] };
  });
}

export function formatReceiptDate(date) {
  if (!date) return "—";
  return new Date(date).toLocaleString("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
