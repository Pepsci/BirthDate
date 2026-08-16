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
    marginLeft: 4,
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
    // la rotation, l'encre occupe x ∈ [-7,07 ; 0] autour du centre de la boîte
    // (pointe à gauche, extrémités des branches à droite). Son emprise est donc
    // centrée sur -3,54 px, d'où le décalage inverse appliqué ici.
    //
    // `left` et non `marginLeft` : une marge élargit la boîte que le parent
    // centre, si bien qu'un `marginLeft: 3` ne déplaçait réellement le chevron
    // que de 1,5 px — la moitié — et le laissait décalé vers la gauche.
    // `left` décale le rendu sans entrer dans ce calcul de centrage.
    left: 3.5,
  },
});
