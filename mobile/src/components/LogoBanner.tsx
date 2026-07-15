import { Pressable, Image, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import {
  useTheme,
  useThemedStyles,
  ThemeColors,
} from "../lib/theme-context";

/**
 * Bannière de marque affichée en haut des écrans principaux.
 * Cliquer sur le logo ramène à la page d'accueil (/welcome).
 * Le logo s'adapte au thème (wordmark clair ou sombre).
 */
const LOGO_LIGHT = require("../../assets/images/logo-light.png");
const LOGO_DARK = require("../../assets/images/logo-dark.png");

export default function LogoBanner() {
  const router = useRouter();
  const { resolved } = useTheme();
  const styles = useThemedStyles(makeStyles);

  return (
    <Pressable
      style={({ pressed }) => [styles.bar, pressed && { opacity: 0.6 }]}
      onPress={() => router.push("/welcome")}
      hitSlop={6}
      accessibilityRole="link"
      accessibilityLabel="Accueil BirthReminder"
    >
      <Image
        source={resolved === "dark" ? LOGO_DARK : LOGO_LIGHT}
        style={styles.logo}
        resizeMode="contain"
      />
    </Pressable>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    bar: {
      height: 46,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: c.headerBg,
    },
    // Ratio du wordmark 560×180 ≈ 3.11
    logo: { height: 32, aspectRatio: 560 / 180 },
  });
