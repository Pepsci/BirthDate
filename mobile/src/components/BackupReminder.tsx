import { useCallback, useState } from "react";
import { Pressable, Text, View, StyleSheet } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useAuth } from "../lib/auth-context";
import { getLastBackupAt } from "../lib/local-backup";
import { countLocalDates } from "../lib/local-store";
import { useThemedStyles, ThemeColors } from "../lib/theme-context";

/**
 * Bandeau d'accueil du mode local : « Pense à sauvegarder tes cartes ».
 * Affiché s'il y a au moins MIN_CARDS cartes et aucune sauvegarde depuis
 * MAX_AGE_DAYS jours (docs/MODE_LOCAL.md § 3.2). Masquable jusqu'au
 * prochain lancement de l'app.
 */
const MIN_CARDS = 10;
const MAX_AGE_DAYS = 30;

let dismissedThisSession = false;

export default function BackupReminder() {
  const { mode } = useAuth();
  const router = useRouter();
  const styles = useThemedStyles(makeStyles);
  const [show, setShow] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (mode !== "local" || dismissedThisSession) {
        setShow(false);
        return;
      }
      let cancelled = false;
      Promise.all([countLocalDates(), getLastBackupAt()])
        .then(([count, last]) => {
          const stale = !last || Date.now() - last > MAX_AGE_DAYS * 86_400_000;
          if (!cancelled) setShow(count >= MIN_CARDS && stale);
        })
        .catch(() => {});
      return () => {
        cancelled = true;
      };
    }, [mode]),
  );

  if (!show) return null;

  return (
    <View style={styles.banner}>
      <Pressable style={styles.body} onPress={() => router.push("/profile/local-data")}>
        <Text style={styles.title}>💾 Pense à sauvegarder tes cartes</Text>
        <Text style={styles.text}>
          Sans compte, elles n'existent que sur ce téléphone.
        </Text>
      </Pressable>
      <Pressable
        hitSlop={10}
        accessibilityLabel="Masquer"
        onPress={() => {
          dismissedThisSession = true;
          setShow(false);
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
      backgroundColor: c.warningSoft,
      borderRadius: 12,
      paddingVertical: 10,
      paddingHorizontal: 14,
      marginHorizontal: 12,
      marginTop: 8,
    },
    body: { flex: 1 },
    title: { fontSize: 14, fontWeight: "700", color: c.warningStrong },
    text: { fontSize: 12.5, color: c.warningStrong, marginTop: 2 },
    close: { fontSize: 16, color: c.warningStrong, fontWeight: "700" },
  });
