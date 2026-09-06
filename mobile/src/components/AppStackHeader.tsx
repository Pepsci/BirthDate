import { View, Text, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useThemedStyles, ThemeColors } from "../lib/theme-context";

/**
 * En-tête des écrans empilés, rendu en JS.
 *
 * ⚠️ Pourquoi ne pas utiliser l'en-tête natif. Sur iOS récent, UIKit dessine
 * derrière chaque UIBarButtonItem une capsule translucide de 44 pt, et il n'y
 * place pas notre vue exactement au centre : mesuré sur capture, notre rond de
 * 34 pt s'y retrouvait décalé de 1,5 à 1,75 px. Ce décalage naît côté natif,
 * après le layout React Native — aucune valeur en JS ne peut l'annuler. Toutes
 * les tentatives précédentes (marges, `left` optique, taille du glyphe, puis
 * alignement de notre vue sur les 44 pt de la capsule) ne faisaient que
 * déplacer le problème : à 44 pt la capsule est simplement devenue un ovale.
 *
 * Les onglets n'ont jamais eu ce problème parce qu'ils rendent déjà leur propre
 * en-tête (`header:` dans (tabs)/_layout.tsx, composant AppHeader). On applique
 * ici la même approche : sans UIBarButtonItem, il n'y a plus de capsule, et la
 * position des boutons ne dépend plus que de notre propre layout.
 *
 * Options gérées : `title` (chaîne), `headerTitle` (élément ou fonction),
 * `headerLeft`, `headerRight`. `headerShown: false` reste géré par le Stack et
 * n'atteint jamais ce composant.
 */
export default function AppStackHeader({ options, route }: any) {
  const insets = useSafeAreaInsets();
  const s = useThemedStyles(makeStyles);

  const left = options.headerLeft?.({});
  const right = options.headerRight?.({});

  // headerTitle peut être une fonction (chat : avatar + nom cliquables), un
  // élément, ou rien — auquel cas on retombe sur `title` puis le nom de route.
  let title = null;
  if (typeof options.headerTitle === "function") {
    title = options.headerTitle({});
  } else if (options.headerTitle) {
    title = options.headerTitle;
  } else {
    title = (
      <Text style={s.title} numberOfLines={1}>
        {options.title ?? route.name}
      </Text>
    );
  }

  return (
    <View style={[s.wrap, { paddingTop: insets.top }]}>
      <View style={s.row}>
        {/* Titre centré en absolu, et déclaré EN PREMIER pour passer sous les
            boutons : un titre long ne peut donc jamais les recouvrir.
            Les marges left/right le tiennent à l'écart des deux côtés. */}
        <View style={s.titleWrap}>{title}</View>

        <View style={s.side}>{left}</View>
        {/* pointerEvents none : cet espaceur couvre le titre, sans quoi il
            intercepterait les appuis destinés à un titre interactif (l'avatar
            de la conversation ouvre la fiche du contact). */}
        <View style={s.spacer} pointerEvents="none" />
        <View style={[s.side, s.sideRight]}>{right}</View>
      </View>
    </View>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    wrap: {
      backgroundColor: c.headerBg,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      height: 44,
      paddingHorizontal: 12,
    },
    titleWrap: {
      position: "absolute",
      left: 64,
      right: 64,
      top: 0,
      bottom: 0,
      alignItems: "center",
      justifyContent: "center",
    },
    title: { fontSize: 17, fontWeight: "600", color: c.text },
    side: { justifyContent: "center" },
    sideRight: { alignItems: "flex-end" },
    spacer: { flex: 1 },
  });
