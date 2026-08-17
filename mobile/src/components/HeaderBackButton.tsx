import { Pressable, View, StyleSheet } from "react-native";
import { useNavigation } from "expo-router";
import { useTheme } from "../lib/theme-context";

/**
 * Bouton retour custom (chevron dans un rond) qui remplace le bouton natif.
 * Le bouton retour natif iOS peut devenir intermittent/inopérant sur certains
 * écrans empilés ; en le pilotant nous-mêmes en JS on garantit qu'un appui
 * ramène toujours à l'écran précédent.
 */
export default function HeaderBackButton() {
  const navigation = useNavigation();
  const { colors } = useTheme();

  const goBack = () => {
    if (navigation.canGoBack()) navigation.goBack();
  };

  return (
    <Pressable
      onPress={goBack}
      hitSlop={14}
      accessibilityRole="button"
      accessibilityLabel="Retour"
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: colors.card, borderColor: colors.border },
        pressed && { opacity: 0.6 },
      ]}
    >
      <View style={[styles.chevron, { borderColor: colors.primary }]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
    // ⚠️ Aucune marge ici. iOS enveloppe le bouton dans un UIBarButtonItem et
    // dessine derrière lui son propre fond (le disque gris translucide visible
    // depuis iOS 26). Ce fond épouse la vue qu'on lui donne, MARGES COMPRISES :
    // un `marginLeft: 4` élargissait donc la vue à 38 px et y plaçait notre
    // rond de 34 px collé à droite — d'où un rond visiblement décentré dans son
    // fond gris. Sans marge, les deux sont concentriques.
    // L'espacement avec le bord de l'écran est déjà géré par la barre native.
  },
  // Chevron dessiné avec deux bordures plutôt qu'un glyphe "‹" :
  // le caractère a un chasse (bearing) qui l'empêche d'être parfaitement
  // centré dans le rond. Un carré borduré + rotation 45° est net et centré.
  chevron: {
    width: 10,
    height: 10,
    borderLeftWidth: 2,
    borderBottomWidth: 2,
    transform: [{ rotate: "45deg" }],
    // Recentrage optique. Seules deux bordures sur quatre sont peintes : après
    // la rotation, l'encre occupe x ∈ [-7,07 ; 0] autour du centre de la boîte,
    // pointe à gauche et extrémités des branches à droite.
    //
    // On centre sur le CENTRE DE MASSE de l'encre (-2,51 px), pas sur son
    // emprise (-3,54 px). Un chevron est une forme ouverte : ses deux branches
    // s'écartent vers la droite en laissant du vide entre elles, si bien que
    // centrer l'emprise pousse visiblement le trait trop à droite. L'œil suit
    // la matière, pas la boîte englobante.
    //
    // `left` et non `marginLeft` : une marge élargit la boîte que le parent
    // centre, si bien qu'un `marginLeft: 3` ne déplaçait réellement le chevron
    // que de 1,5 px — la moitié — et le laissait décalé vers la gauche.
    // `left` décale le rendu sans entrer dans ce calcul de centrage.
    left: 2.5,
  },
});
