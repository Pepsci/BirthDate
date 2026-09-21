import { Pressable, StyleSheet } from "react-native";
import { useNavigation, usePathname, useRouter } from "expo-router";
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
 *
 * ⚠️ Écran ouvert directement depuis un lien (email, invitation, notification
 * au démarrage) : il n'y a AUCUN écran derrière lui. Le bouton n'était alors
 * pas affiché et l'utilisateur restait coincé sur la page. Il est désormais
 * toujours là et, faute d'écran précédent, remplace la page par l'onglet
 * dont elle dépend (voir fallbackFor).
 */

/** Onglet de rattachement d'une page ouverte sans historique. */
export function fallbackFor(pathname: string): string {
  if (pathname.startsWith("/event") || pathname.startsWith("/events")) {
    return "/events";
  }
  if (pathname.startsWith("/chat")) return "/chats";
  if (
    pathname.startsWith("/profile") ||
    pathname.startsWith("/friends") ||
    pathname.startsWith("/support") ||
    pathname.startsWith("/guide") ||
    pathname.startsWith("/contact")
  ) {
    return "/profile";
  }
  return "/";
}
export default function HeaderBackButton() {
  const navigation = useNavigation();
  const router = useRouter();
  const pathname = usePathname();
  const { colors } = useTheme();

  const goBack = () => {
    if (navigation.canGoBack()) navigation.goBack();
    else router.replace(fallbackFor(pathname) as any);
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
