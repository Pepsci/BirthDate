import { Pressable, View, Text, StyleSheet } from "react-native";
import { useTheme } from "../lib/theme-context";

/**
 * Bouton d'action dans l'en-tête (crayon, chat, corbeille…), pendant droit de
 * HeaderBackButton : même rond de 34 px, même fond, même bordure.
 *
 * ⚠️ La taille est FIXE et entièrement déterministe, c'est le point important.
 * Les boutons d'en-tête étaient auparavant déclarés en `minWidth: 36` avec un
 * badge dans le flux : leur largeur dépendait donc du contenu, et iOS dessine
 * autour d'un `UIBarButtonItem` un fond dont la taille est arrêtée avant que
 * React Native n'ait mesuré la vue. Résultat, le bouton apparaissait parfois
 * étiré sur toute la largeur disponible, puis reprenait sa forme après une
 * navigation (qui force un nouveau layout). Avec une largeur constante il n'y
 * a plus de mesure à attendre.
 *
 * Le badge est donc positionné en absolu : dans le flux, il changerait la
 * largeur du bouton et ramènerait exactement le problème.
 */
export default function HeaderIconButton({
  emoji,
  onPress,
  badge = 0,
  accessibilityLabel,
  fontSize = 18,
}: {
  emoji: string;
  onPress: () => void;
  /** Pastille de non-lus ; masquée si 0. */
  badge?: number;
  accessibilityLabel: string;
  fontSize?: number;
}) {
  const { colors } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: colors.card, borderColor: colors.border },
        pressed && { opacity: 0.6 },
      ]}
    >
      <Text style={[styles.emoji, { fontSize }]}>{emoji}</Text>
      {badge > 0 && (
        <View style={[styles.badge, { backgroundColor: colors.danger }]}>
          <Text style={styles.badgeText}>{badge > 99 ? "99+" : badge}</Text>
        </View>
      )}
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
    marginRight: 4,
  },
  emoji: {
    // includeFontPadding/textAlignVertical : sans eux, l'emoji est décalé
    // vers le bas dans le rond sur Android.
    includeFontPadding: false,
    textAlignVertical: "center",
  },
  badge: {
    position: "absolute",
    top: -4,
    right: -4,
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { color: "#fff", fontSize: 10, fontWeight: "700" },
});
