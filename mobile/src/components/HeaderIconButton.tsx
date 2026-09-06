import { Pressable, View, Text, StyleSheet } from "react-native";
import { useTheme } from "../lib/theme-context";
import Icon, { IconName } from "./icons/Icon";
import {
  HEADER_ICON_INSET,
  SHOW_OWN_RING,
  headerButtonBase,
} from "./headerButtonStyle";

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
 *
 * L'icône est un SVG et non plus un emoji : un glyphe repose sur la ligne de
 * base et sa boîte réserve la place du jambage descendant, si bien qu'un emoji
 * centré par le conteneur apparaît trop haut — on corrigeait ça par un `top`
 * proportionnel à la taille de police, dont la bonne valeur dépendait de la
 * police système. Le viewBox SVG rend ce réglage inutile.
 */
export default function HeaderIconButton({
  name,
  onPress,
  badge = 0,
  accessibilityLabel,
  inset = HEADER_ICON_INSET,
}: {
  name: IconName;
  onPress: () => void;
  /** Pastille de non-lus ; masquée si 0. */
  badge?: number;
  accessibilityLabel: string;
  /** Marge du tracé dans le bouton, en unités de viewBox (voir Icon). */
  inset?: number;
}) {
  const { colors } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [
        headerButtonBase.btn,
        SHOW_OWN_RING && {
          backgroundColor: colors.card,
          borderColor: colors.border,
          borderWidth: StyleSheet.hairlineWidth,
        },
        pressed && { opacity: 0.6 },
      ]}
    >
      <Icon name={name} fill inset={inset} color={colors.primary} />
      {badge > 0 && (
        <View style={[styles.badge, { backgroundColor: colors.danger }]}>
          <Text style={styles.badgeText}>{badge > 99 ? "99+" : badge}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // Le bouton grandissant de 34 à 44 pt (voir headerButtonStyle.ts), la
  // pastille sortait trop loin du glyphe avec ses anciens -4 : on la ramène
  // sur le bord visuel de l'icône.
  badge: {
    position: "absolute",
    top: 3,
    right: 3,
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { color: "#fff", fontSize: 10, fontWeight: "700" },
});
