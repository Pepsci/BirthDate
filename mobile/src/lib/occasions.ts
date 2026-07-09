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
  { value: "Anniversaire", emoji: "🎂", label: "Anniversaire" },
  { value: "Noël", emoji: "🎄", label: "Noël" },
  { value: "Saint-Valentin", emoji: "💝", label: "Saint-Valentin" },
  { value: "Fête des Mères", emoji: "💐", label: "Fête des Mères" },
  { value: "Fête des Pères", emoji: "👔", label: "Fête des Pères" },
  { value: "Mariage", emoji: "💍", label: "Mariage" },
  { value: "Naissance", emoji: "👶", label: "Naissance" },
  { value: "Diplôme", emoji: "🎓", label: "Diplôme" },
  { value: "Crémaillère", emoji: "🏠", label: "Crémaillère" },
  { value: "Autre", emoji: "✨", label: "Autre" },
];

/** Emoji correspondant à une occasion (fallback 🎁). */
export function occasionEmoji(occasion?: string | null): string {
  return OCCASIONS.find((o) => o.value === occasion)?.emoji ?? "🎁";
}
