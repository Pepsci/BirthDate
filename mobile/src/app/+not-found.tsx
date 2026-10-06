import { t } from "@/i18n";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Stack, useRouter } from "expo-router";
import { useThemedStyles, ThemeColors } from "../lib/theme-context";

/**
 * Écran affiché quand un lien ouvre une adresse que l'app ne connaît pas
 * (lien profond mal formé, ancienne adresse…). Sans lui, expo-router montre
 * son écran technique « Unmatched Route », en anglais.
 *
 * Aucun appel serveur : valable aussi en mode sans compte. Le retour à
 * l'accueil passe par "/", et c'est la garde de `_layout.tsx` qui envoie au
 * bon endroit selon le mode (compte, local, non connecté).
 */
export default function NotFoundScreen() {
  const styles = useThemedStyles(makeStyles);
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <Text style={styles.emoji}>🎈</Text>
      <Text style={styles.title}>{t("common:notFound.title")}</Text>
      <Text style={styles.text}>{t("common:notFound.text")}</Text>
      <Pressable
        style={styles.button}
        onPress={() => router.replace("/")}
        accessibilityRole="button"
      >
        <Text style={styles.buttonText}>{t("common:notFound.home")}</Text>
      </Pressable>
    </View>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      padding: 32,
      backgroundColor: c.bg,
    },
    emoji: { fontSize: 56, marginBottom: 12 },
    title: {
      fontSize: 22,
      fontWeight: "700",
      color: c.text,
      textAlign: "center",
      marginBottom: 8,
    },
    text: {
      fontSize: 15,
      lineHeight: 22,
      color: c.sub,
      textAlign: "center",
      marginBottom: 28,
    },
    button: {
      backgroundColor: c.primary,
      paddingVertical: 14,
      paddingHorizontal: 28,
      borderRadius: 12,
    },
    buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  });
