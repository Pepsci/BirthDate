/**
 * Statut d'une idée cadeau — 3 états (aligné avec le mobile).
 * `status` est stocké en base ; `purchased` reste synchro pour compat.
 * `badge` = classe CSS existante réutilisée (pending / purchased / reserved).
 */
export const GIFT_STATUSES = ["to_buy", "bought", "to_give", "offered"];

export const GIFT_STATUS_META = {
  to_buy: {
    label: "À acheter",
    short: "À acheter",
    emoji: "🛒",
    badge: "pending",
  },
  bought: {
    label: "Acheté",
    short: "Acheté",
    emoji: "✅",
    badge: "purchased",
  },
  to_give: {
    label: "Acheté & à offrir",
    short: "À offrir",
    emoji: "🎁",
    badge: "reserved",
  },
  offered: {
    label: "Offert",
    short: "Offert",
    emoji: "🎉",
    badge: "shared",
  },
};

export function giftStatusOf(gift) {
  if (gift?.status && GIFT_STATUSES.includes(gift.status)) return gift.status;
  return gift?.purchased ? "bought" : "to_buy";
}

export function nextGiftStatus(status) {
  const i = GIFT_STATUSES.indexOf(status);
  return GIFT_STATUSES[(i + 1) % GIFT_STATUSES.length];
}

export function purchasedFromStatus(status) {
  return status !== "to_buy";
}
