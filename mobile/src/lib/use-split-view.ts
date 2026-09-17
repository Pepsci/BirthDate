import { useEffect, useSyncExternalStore } from "react";
import { useWindowDimensions } from "react-native";
import * as SecureStore from "expo-secure-store";

/**
 * Affichage « deux panneaux » sur grand écran (iPad, iPhone Duo déplié,
 * Android pliable).
 *
 * On ne détecte PAS le modèle d'appareil : on lit la taille de la fenêtre,
 * qui change d'elle-même au pliage/dépliage, à la rotation et en Split View.
 *
 * Deux conditions, toutes deux nécessaires :
 * - largeur ≥ 600 : sinon chaque panneau serait plus étroit qu'un téléphone ;
 * - hauteur ≥ 600 : un iPhone Pro Max à l'horizontale dépasse 600 de large
 *   mais n'a que ~430 de haut — deux colonnes y seraient illisibles.
 *
 * Le réglage utilisateur (« Affichage deux panneaux ») permet de garder une
 * seule colonne même sur grand écran. Préférence locale à l'appareil
 * (SecureStore), comme `collapse-prefs.ts` : un iPad et un téléphone d'un
 * même compte n'ont aucune raison de partager ce choix.
 *
 * Le réglage est partagé entre écrans via un petit store module
 * (useSyncExternalStore) : le basculer dans le Profil met à jour tout écran
 * déjà monté, sans contexte supplémentaire à brancher dans _layout.
 */

export const SPLIT_MIN_WIDTH = 600;
export const SPLIT_MIN_HEIGHT = 600;

const PREF_KEY = "split_view_enabled";

let enabled = true; // défaut : actif dès que l'écran le permet
let loaded = false;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot() {
  return enabled;
}

/** Lecture unique au premier usage ; les écrans suivants lisent le cache. */
function loadOnce() {
  if (loaded) return;
  loaded = true;
  SecureStore.getItemAsync(PREF_KEY)
    .then((saved) => {
      if (saved === "false" && enabled) {
        enabled = false;
        emit();
      }
    })
    .catch(() => {
      // Lecture impossible → on garde le défaut
    });
}

export function setSplitViewEnabled(next: boolean): void {
  if (next === enabled) return;
  enabled = next;
  emit();
  SecureStore.setItemAsync(PREF_KEY, String(next)).catch(() => {});
}

/** Le réglage seul, pour l'interrupteur de l'écran Profil. */
export function useSplitViewPreference(): [boolean, (next: boolean) => void] {
  useEffect(loadOnce, []);
  const value = useSyncExternalStore(subscribe, getSnapshot);
  return [value, setSplitViewEnabled];
}

/**
 * true quand l'écran doit afficher deux panneaux côte à côte.
 * `screenFits` indique si l'écran le PERMET (utile pour n'afficher
 * l'interrupteur du Profil que sur les appareils concernés).
 */
export function useSplitView(options?: {
  /**
   * N'autorise les deux panneaux qu'en paysage (largeur > hauteur).
   * Pour les écrans dont les deux moitiés ont besoin de place — la page d'un
   * événement : un iPad à la verticale y garde une seule colonne.
   */
  landscapeOnly?: boolean;
}): { isSplit: boolean; screenFits: boolean } {
  const { width, height } = useWindowDimensions();
  const [pref] = useSplitViewPreference();
  const screenFits =
    width >= SPLIT_MIN_WIDTH &&
    height >= SPLIT_MIN_HEIGHT &&
    (!options?.landscapeOnly || width > height);
  return { isSplit: screenFits && pref, screenFits };
}
