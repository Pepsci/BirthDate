import { useCallback, useState } from "react";
import {
  View,
  Text,
  Switch,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { Stack, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { UserProfile, fetchMe, updateMe } from "../../lib/users";
import {
  useTheme,
  useThemedStyles,
  ThemeColors,
} from "../../lib/theme-context";
import { useStatsScope, setStatsScope } from "../../lib/stats-scope";

/**
 * Réglages d'affichage. Écran destiné à accueillir au fil du temps les
 * options d'interface (première : cacher les fêtes sur les cartes anniv).
 */
export default function SettingsScreen() {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [me, setMe] = useState<UserProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const statsScope = useStatsScope();

  // useFocusEffect : cet écran reste monté dans la pile entre deux visites
  // (ex. aller cocher "Rappels de fêtes" dans Notifications puis revenir
  // ici) — sans ça, "me" reste figé sur sa valeur du tout premier montage et
  // les deux écrans peuvent sembler « désynchronisés ».
  useFocusEffect(
    useCallback(() => {
      fetchMe()
        .then(setMe)
        .catch((e) => setError(e?.message ?? "Erreur de chargement."));
    }, []),
  );

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
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        { paddingBottom: 40 + insets.bottom },
      ]}
    >
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

      <Text style={styles.sectionHeader}>🏠 Affichage accueil</Text>
      <View style={styles.card}>
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Afficher mes statistiques</Text>
            <Text style={styles.hint}>
              L'encart de l'accueil montre vos propres chiffres au lieu de ceux
              de toute la communauté. Réglage propre à cet appareil.
            </Text>
          </View>
          <Switch
            value={statsScope === "personal"}
            onValueChange={(v) => setStatsScope(v ? "personal" : "community")}
            trackColor={{ true: colors.primary }}
          />
        </View>
        <View style={[styles.row, styles.rowSeparator]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Afficher la fête du jour</Text>
            <Text style={styles.hint}>
              Affiche « C'est la fête de … ! » sur l'écran d'accueil quand
              l'un de vos proches fête son nom aujourd'hui.
            </Text>
          </View>
          <Switch
            value={me.showTodayNamedayOnHome !== false}
            disabled={busy === "showTodayNamedayOnHome"}
            onValueChange={(v) => toggle("showTodayNamedayOnHome", v)}
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
    rowSeparator: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.border,
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
