import { StyleSheet } from "react-native";

/**
 * Géométrie commune aux boutons d'en-tête (retour + actions).
 *
 * Ces boutons sont rendus dans AppStackHeader, notre en-tête JS — pas dans
 * l'en-tête natif. C'est ce qui rend ces valeurs fiables : sans
 * UIBarButtonItem, iOS ne dessine aucune capsule derrière eux, et rien ne
 * vient décaler notre vue après le layout. Le rond ci-dessous est donc le seul
 * fond, et le glyphe y est centré par le viewBox du SVG.
 *
 * SHOW_OWN_RING à false ne laisse que le glyphe, sans fond. Utile si on veut
 * un jour des boutons d'en-tête plus discrets ; sans capsule native pour
 * prendre le relais, ils apparaissent alors nus sur toutes les plateformes.
 */
export const HEADER_BTN_SIZE = 34;
export const SHOW_OWN_RING = true;

/**
 * Marge du tracé dans le bouton, en unités de viewBox (voir Icon).
 * 24 / (24 + 2 × 8) × 34 ≈ 20 pt de glyphe dans un bouton de 34.
 */
export const HEADER_ICON_INSET = 8;

export const headerButtonBase = StyleSheet.create({
  btn: {
    width: HEADER_BTN_SIZE,
    height: HEADER_BTN_SIZE,
    borderRadius: HEADER_BTN_SIZE / 2,
    alignItems: "center",
    justifyContent: "center",
    // L'espacement avec le bord de l'écran est porté par le paddingHorizontal
    // de AppStackHeader, pas par une marge ici : une marge sur un bouton rond
    // élargit sa boîte sans élargir le rond, ce qui décale son contenu.
  },
});
