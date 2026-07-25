/**
 * Statut d'une idée cadeau — 3 états.
 * `status` est stocké en base ; `purchased` reste synchro pour la compat web.
 */
export type GiftStatus = "to_buy" | "bought" | "to_give" | "offered";

// États sélectionnables par l'utilisateur.
// "to_give" a été retiré du cycle mais reste dans le type et GIFT_STATUS_META
// pour rester rétro-compatible avec les cadeaux déjà en base (affichés/repliés
// sur "Acheté" via giftStatusOf).
export const GIFT_STATUSES: GiftStatus[] = ["to_buy", "bought", "offered"];

export interface GiftStatusMeta {
  label: string;
  short: string;
  emoji: string;
  color: string; // couleur du texte
  bg: string; // fond du badge
}

export const GIFT_STATUS_META: Record<GiftStatus, GiftStatusMeta> = {
  to_buy: {
    label: "À acheter",
    short: "À acheter",
    emoji: "🛒",
    color: "#b45309",
    bg: "#fef3c7",
  },
  bought: {
    label: "Acheté",
    short: "Acheté",
    emoji: "✅",
    color: "#047857",
    bg: "#d1fae5",
  },
  to_give: {
    label: "Acheté & à offrir",
    short: "À offrir",
    emoji: "🎁",
    color: "#2563eb",
    bg: "#dbeafe",
  },
  offered: {
    label: "Offert",
    short: "Offert",
    emoji: "🎉",
    color: "#7c3aed",
    bg: "#ede9fe",
  },
};

/** Statut effectif d'un cadeau (fallback sur `purchased` pour les anciens). */
export function giftStatusOf(g: {
  status?: string | null;
  purchased?: boolean;
}): GiftStatus {
  if (g.status && (GIFT_STATUSES as string[]).includes(g.status)) {
    return g.status as GiftStatus;
  }
  return g.purchased ? "bought" : "to_buy";
}

/** Statut suivant dans le cycle (tap sur le badge). */
export function nextGiftStatus(s: GiftStatus): GiftStatus {
  const i = GIFT_STATUSES.indexOf(s);
  return GIFT_STATUSES[(i + 1) % GIFT_STATUSES.length];
}

/** `purchased` dérivé pour garder le web cohérent. */
export function purchasedFromStatus(s: GiftStatus): boolean {
  return s !== "to_buy";
}
