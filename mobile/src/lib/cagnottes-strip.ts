import { useEffect, useState } from "react";
import * as SecureStore from "expo-secure-store";

/**
 * Visibilité du bandeau « Mes cagnottes » sur l'accueil.
 *
 * ⚠️ État partagé entre deux fichiers qui ne se voient pas : le bandeau vit
 * dans l'écran (tabs)/index.tsx, le bouton qui le rappelle vit dans l'en-tête
 * déclaré par (tabs)/_layout.tsx. Passer par une prop supposerait de faire
 * remonter l'état jusqu'au navigateur, ce que la structure d'expo-router ne
 * permet pas simplement — d'où ce petit magasin de module, même approche que
 * stats-scope.ts.
 *
 * `hasPools` est renseigné par le bandeau lui-même : l'en-tête n'a aucun moyen
 * de savoir s'il existe des cagnottes, et un bouton qui n'ouvre rien serait
 * pire que pas de bouton.
 */

const KEY = "cagnottes_strip_visible";

let visible = true;
let hasPools = false;
let loaded = false;

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

async function ensureLoaded(): Promise<void> {
  if (loaded) return;
  loaded = true;
  try {
    const saved = await SecureStore.getItemAsync(KEY);
    if (saved === "0") {
      visible = false;
      emit();
    }
  } catch {
    // Préférence illisible → bandeau visible, comme avant.
  }
}

export function setCagnottesVisible(next: boolean): void {
  if (next === visible) return;
  visible = next;
  loaded = true;
  emit();
  SecureStore.setItemAsync(KEY, next ? "1" : "0").catch(() => {});
}

export function toggleCagnottesVisible(): void {
  setCagnottesVisible(!visible);
}

/** Appelé par le bandeau quand il sait combien de cagnottes existent. */
export function setHasPools(next: boolean): void {
  if (next === hasPools) return;
  hasPools = next;
  emit();
}

/** État complet, pour l'écran comme pour l'en-tête. */
export function useCagnottesStrip(): { visible: boolean; hasPools: boolean } {
  const [state, setState] = useState({ visible, hasPools });

  useEffect(() => {
    const listener = () => setState({ visible, hasPools });
    listeners.add(listener);
    ensureLoaded().then(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  return state;
}
