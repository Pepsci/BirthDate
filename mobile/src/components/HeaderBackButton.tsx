import { Pressable, StyleSheet } from "react-native";
import { useNavigation } from "expo-router";
import { useTheme } from "../lib/theme-context";
import Icon from "./icons/Icon";
import {
  HEADER_ICON_INSET,
  SHOW_OWN_RING,
  headerButtonBase,
} from "./headerButtonStyle";

/**
 * Bouton retour custom (chevron dans un rond) qui remplace le bouton natif.
 * Le bouton retour natif iOS peut devenir intermittent/inopérant sur certains
 * écrans empilés ; en le pilotant nous-mêmes en JS on garantit qu'un appui
 * ramène toujours à l'écran précédent.
 *
 * Le chevron est une icône SVG : son centrage vient du viewBox, pas d'un
 * réglage optique (cf. components/icons/Icon.tsx). Les versions précédentes le
 * dessinaient avec un carré bordé tourné à 45°, recalé par un `left` calculé à
 * la main — c'est ce qui le laissait visiblement décentré dans son rond.
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
        headerButtonBase.btn,
        SHOW_OWN_RING && {
          backgroundColor: colors.card,
          borderColor: colors.border,
          borderWidth: StyleSheet.hairlineWidth,
        },
        pressed && { opacity: 0.6 },
      ]}
    >
      <Icon
        name="chevron-left"
        fill
        inset={HEADER_ICON_INSET}
        color={colors.primary}
      />
    </Pressable>
  );
}
