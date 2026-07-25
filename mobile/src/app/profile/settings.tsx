import { useEffect, useState } from "react";
import {
  View,
  Text,
  Switch,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { Stack } from "expo-router";
import { UserProfile, fetchMe, updateMe } from "../../lib/users";
import {
  useTheme,
  useThemedStyles,
  ThemeColors,
} from "../../lib/theme-context";

/**
 * Réglages d'affichage. Écran destiné à accueillir au fil du temps les
 * options d'interface (première : cacher les fêtes sur les cartes anniv).
 */
export default function SettingsScreen() {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  const [me, setMe] = useState<UserProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    fetchMe()
      .then(setMe)
      .catch((e) => setError(e?.message ?? "Erreur de chargement."));
  }, []);

  const toggle = async (key: keyof UserProfile & string, value: boolean) => {
    if (!me || busy) return;
    setBusy(key);
    setError(null);
    setMe({ ...me, [key]: value }); // optimiste
    try {
      await updateMe({ [key]: value });
    } catch (e: any) {
      setMe({ ...me, [key]: !value }); // rollback
      setError(e?.message ?? "Erreur d'enregistrement.");
    } finally {
      setBusy(null);
    }
  };

  if (!me) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title: "Réglages" }} />
        {error ? (
          <Text style={styles.error}>{error}</Text>
        ) : (
          <ActivityIndicator size="large" color={colors.primary} />
        )}
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: "Réglages" }} />
      {error && <Text style={styles.error}>{error}</Text>}

      <Text style={styles.sectionHeader}>🎂 Affichage des cartes</Text>
      <View style={styles.card}>
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Cacher les fêtes</Text>
            <Text style={styles.hint}>
              Masque la ligne « fête » sur les cartes d'anniversaire.
            </Text>
          </View>
          <Switch
            value={!!me.hideNamedaysOnCards}
            disabled={busy === "hideNamedaysOnCards"}
            onValueChange={(v) => toggle("hideNamedaysOnCards", v)}
            trackColor={{ true: colors.primary }}
          />
        </View>
      </View>
    </ScrollView>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    content: { padding: 12, gap: 10 },
    center: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: c.bg,
    },
    error: { color: c.danger, textAlign: "center", padding: 8 },
    card: { backgroundColor: c.card, borderRadius: 14, overflow: "hidden" },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      padding: 14,
    },
    label: { fontSize: 15, fontWeight: "600", color: c.text },
    hint: { fontSize: 12, color: c.sub, marginTop: 1 },
    sectionHeader: {
      fontSize: 13,
      fontWeight: "700",
      color: c.sub,
      textTransform: "uppercase",
      marginTop: 10,
      marginLeft: 4,
    },
  });
