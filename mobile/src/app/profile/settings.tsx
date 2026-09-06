import { useCallback, useState } from "react";
import {
  View,
  Text,
  Switch,
  Pressable,
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
import { isCalendarAvailable } from "../../lib/calendar";
import {
  ALL_DAY_CHOICES,
  TIMED_CHOICES,
  useCalendarPrefs,
  toggleCalendarPref,
} from "../../lib/calendar-prefs";

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
  const calendarPrefs = useCalendarPrefs();
  // Le module natif expo-calendar n'existe que dans un binaire reconstruit
  // après son ajout : sur un client plus ancien, la section n'aurait aucun
  // effet, autant ne pas la montrer (cf. lib/calendar.ts).
  const calendarReady = isCalendarAvailable();

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

      {calendarReady && (
        <>
          <Text style={styles.sectionHeader}>📅 Rappels du calendrier</Text>
          <View style={styles.card}>
            <View style={styles.blockHeader}>
              <Text style={styles.label}>Événements</Text>
              <Text style={styles.hint}>
                Rappels posés dans votre agenda quand vous ajoutez un événement
                depuis BirthReminder. Réglage propre à cet appareil ; il
                s'applique aux prochains ajouts, pas aux entrées déjà créées.
              </Text>
            </View>
            <View style={styles.chipWrap}>
              {TIMED_CHOICES.map((c) => (
                <ReminderChip
                  key={c.minutes}
                  label={c.label}
                  active={calendarPrefs.timed.includes(c.minutes)}
                  onPress={() => toggleCalendarPref("timed", c.minutes)}
                />
              ))}
            </View>

            <View style={[styles.blockHeader, styles.rowSeparator]}>
              <Text style={styles.label}>Anniversaires et fêtes</Text>
              <Text style={styles.hint}>
                Ces entrées durent toute la journée : le rappel se règle donc en
                heure d'horloge, pas en durée avant l'événement.
              </Text>
            </View>
            <View style={styles.chipWrap}>
              {ALL_DAY_CHOICES.map((c) => (
                <ReminderChip
                  key={c.minutes}
                  label={c.label}
                  active={calendarPrefs.allDay.includes(c.minutes)}
                  onPress={() => toggleCalendarPref("allDay", c.minutes)}
                />
              ))}
            </View>

            {calendarPrefs.timed.length === 0 &&
              calendarPrefs.allDay.length === 0 && (
                <Text style={styles.warn}>
                  Aucun rappel sélectionné : les entrées ajoutées à votre agenda
                  ne vous préviendront de rien.
                </Text>
              )}
          </View>
        </>
      )}
    </ScrollView>
  );
}

/** Choix de rappel, multi-sélection. */
function ReminderChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const styles = useThemedStyles(makeStyles);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: active }}
      style={({ pressed }) => [
        styles.chip,
        active && styles.chipActive,
        pressed && { opacity: 0.7 },
      ]}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>
        {active ? "✓ " : ""}
        {label}
      </Text>
    </Pressable>
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
    blockHeader: { paddingHorizontal: 14, paddingTop: 14, paddingBottom: 4 },
    chipWrap: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      paddingHorizontal: 14,
      paddingBottom: 14,
      paddingTop: 6,
    },
    chip: {
      borderRadius: 16,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.bg,
      paddingHorizontal: 12,
      paddingVertical: 7,
    },
    chipActive: { backgroundColor: c.primary, borderColor: c.primary },
    chipText: { fontSize: 13, fontWeight: "600", color: c.sub },
    chipTextActive: { color: c.white },
    warn: {
      fontSize: 12,
      color: c.warning,
      paddingHorizontal: 14,
      paddingBottom: 14,
      lineHeight: 16,
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
