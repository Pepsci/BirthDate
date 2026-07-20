import { Pressable, Text, StyleSheet } from "react-native";
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
      <Text style={[styles.chevron, { color: colors.primary }]}>‹</Text>
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
  chevron: {
    fontSize: 26,
    fontWeight: "700",
    lineHeight: 30,
    marginTop: -2,
    marginLeft: -1,
    includeFontPadding: false,
  },
});
