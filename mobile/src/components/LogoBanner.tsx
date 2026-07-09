import { View, Image, StyleSheet } from "react-native";

/**
 * Bannière de marque affichée en haut des écrans principaux.
 *
 * Dark mode (à venir) : `logo-dark.png` est déjà présent dans assets/images.
 * Dès qu'un ThemeContext existe côté mobile, remplace LOGO par :
 *   const { theme } = useTheme();
 *   const LOGO = theme === "dark"
 *     ? require("../../assets/images/logo-dark.png")
 *     : require("../../assets/images/logo-light.png");
 */
const LOGO = require("../../assets/images/logo-light.png");

export default function LogoBanner() {
  return (
    <View style={styles.bar}>
      <Image source={LOGO} style={styles.logo} resizeMode="contain" />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    height: 46,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  // Ratio du wordmark 560×180 ≈ 3.11
  logo: { height: 32, aspectRatio: 560 / 180 },
});
