import { useCallback, useState } from "react";
import { Linking, Pressable, Text, View, StyleSheet } from "react-native";
import { useFocusEffect } from "expo-router";
import { useAuth } from "../lib/auth-context";
import { AvailableUpdate, checkForUpdate } from "../lib/app-update";
import { useThemedStyles, ThemeColors } from "../lib/theme-context";

/**
 * Bandeau d'accueil : « Nouvelle version disponible ».
 *
 * Évite aux testeurs de chercher le lien du Play Store / de TestFlight :
 * un appui ouvre directement la page de mise à jour. Vérifié à chaque retour
 * sur l'accueil (la réponse serveur est mise en cache 5 min).
 *
 * Masquable jusqu'au prochain lancement de l'app, comme BackupReminder.
 * Mode compte uniquement : en mode local, aucune requête ne part.
 */
let dismissedThisSession = false;

export default function UpdateBanner() {
  const { mode } = useAuth();
  const styles = useThemedStyles(makeStyles);
  const [update, setUpdate] = useState<AvailableUpdate | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (mode !== "account" || dismissedThisSession) {
        setUpdate(null);
        return;
      }
      let cancelled = false;
      checkForUpdate().then((u) => {
        if (!cancelled) setUpdate(u);
      });
      return () => {
        cancelled = true;
      };
    }, [mode]),
  );

  if (!update) return null;

  return (
    <View style={styles.banner}>
      <Pressable
        style={styles.body}
        onPress={() => Linking.openURL(update.url).catch(() => {})}
      >
        <Text style={styles.title}>✨ Nouvelle version disponible</Text>
        <Text style={styles.text}>
          BirthReminder {update.version} est prête. Touche ici pour mettre à jour.
        </Text>
      </Pressable>
      <Pressable
        hitSlop={10}
        accessibilityLabel="Masquer"
        onPress={() => {
          dismissedThisSession = true;
          setUpdate(null);
        }}
      >
        <Text style={styles.close}>✕</Text>
      </Pressable>
    </View>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    banner: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      backgroundColor: c.primarySoft,
      borderRadius: 12,
      paddingVertical: 10,
      paddingHorizontal: 14,
      marginHorizontal: 12,
      marginTop: 8,
    },
    body: { flex: 1 },
    title: { fontSize: 14, fontWeight: "700", color: c.primaryStrong },
    text: { fontSize: 12.5, color: c.primaryStrong, marginTop: 2 },
    close: { fontSize: 16, color: c.primaryStrong, fontWeight: "700" },
  });
