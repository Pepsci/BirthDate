import { t } from "@/i18n";
/**
 * Occasions de cadeaux — liste partagée (miroir du web FriendGiftList).
 * `value` est stocké en base ; `emoji`/`label` pour l'affichage.
 */
export interface Occasion {
  value: string;
  emoji: string;
  label: string;
}

export const OCCASIONS: Occasion[] = [
  { value: "Anniversaire", emoji: "🎂", get label() { return t("gifts:occasion.birthday"); } },
  { value: "Noël", emoji: "🎄", get label() { return t("gifts:occasion.christmas"); } },
  { value: "Saint-Valentin", emoji: "💝", get label() { return t("gifts:occasion.valentine"); } },
  { value: "Fête des Mères", emoji: "💐", get label() { return t("gifts:occasion.mothersDay"); } },
  { value: "Fête des Pères", emoji: "👔", get label() { return t("gifts:occasion.fathersDay"); } },
  { value: "Mariage", emoji: "💍", get label() { return t("gifts:occasion.wedding"); } },
  { value: "Naissance", emoji: "👶", get label() { return t("gifts:occasion.birth"); } },
  { value: "Diplôme", emoji: "🎓", get label() { return t("gifts:occasion.graduation"); } },
  { value: "Crémaillère", emoji: "🏠", get label() { return t("gifts:occasion.housewarming"); } },
  { value: "Autre", emoji: "✨", get label() { return t("gifts:occasion.other"); } },
];

/** Emoji correspondant à une occasion (fallback 🎁). */
export function occasionEmoji(occasion?: string | null): string {
  return OCCASIONS.find((o) => o.value === occasion)?.emoji ?? "🎁";
}

/**
 * Libellé traduit d'une occasion. La VALEUR stockée reste le mot français
 * ("Anniversaire") : c'est elle qui est en base et partagée avec le web.
 * Une occasion inconnue (saisie libre, ancienne donnée) est rendue telle quelle.
 */
export function occasionLabel(occasion?: string | null): string {
  if (!occasion) return "";
  return OCCASIONS.find((o) => o.value === occasion)?.label ?? occasion;
}
