import { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  SectionList,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Pressable,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { useGuidedTour, TOURS } from "../../lib/guided-tour";
import {
  EventEntry,
  fetchMyEvents,
  eventDate,
  formatEventDate,
  EVENT_TYPE_LABELS,
  STATUS_LABELS,
  RSVP_LABELS,
} from "../../lib/events";
import {
  useTheme,
  useThemedStyles,
  ThemeColors,
} from "../../lib/theme-context";

export default function EventsScreen() {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { startTour } = useGuidedTour();
  const [organized, setOrganized] = useState<EventEntry[]>([]);
  const [invited, setInvited] = useState<EventEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const { organized, invited } = await fetchMyEvents();
      setOrganized(organized);
      setInvited(invited);
    } catch (e: any) {
      setError(e?.message ?? "Erreur de chargement.");
    }
  }, []);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  // Recharge à chaque retour sur l'onglet : sans ça, un événement supprimé
  // (ex. depuis le web) reste affiché en vignette jusqu'au redémarrage de
  // l'app, et l'ouvrir mène à un écran « Événement introuvable ».
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  // Tour guidé : créer son premier événement (＋) — première visite uniquement
  useEffect(() => {
    startTour(TOURS.events);
  }, [startTour]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const sections = useMemo(
    () =>
      [
        { title: "J'organise", data: organized },
        { title: "Je suis invité·e", data: invited },
      ].filter((s) => s.data.length > 0),
    [organized, invited],
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {error && (
        <Pressable style={styles.errorBanner} onPress={onRefresh}>
          <Text style={styles.errorText}>{error} — appuyer pour réessayer</Text>
        </Pressable>
      )}

      <SectionList
        sections={sections}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.list}
        stickySectionHeadersEnabled={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        renderSectionHeader={({ section }) => (
          <Text style={styles.sectionTitle}>{section.title}</Text>
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>
            Aucun événement pour l'instant. Crée-en un depuis le site web — il
            apparaîtra ici.
          </Text>
        }
        renderItem={({ item }) => <EventCard event={item} />}
      />
    </View>
  );
}

function EventCard({ event }: { event: EventEntry }) {
  const router = useRouter();
  const styles = useThemedStyles(makeStyles);
  const d = eventDate(event);
  const location =
    typeof event.fixedLocation === "string"
      ? event.fixedLocation
      : event.fixedLocation?.name ?? event.fixedLocation?.address;

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}
      onPress={() => router.push(`/event/${event.shortId}`)}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.title} numberOfLines={1}>
          {event.title}
        </Text>
        <Text style={styles.type}>{EVENT_TYPE_LABELS[event.type]}</Text>
      </View>

      <Text style={styles.detail}>
        📅 {d ? formatEventDate(d) : "Date au vote"}
      </Text>
      {location ? (
        <Text style={styles.detail}>📍 {location}</Text>
      ) : event.locationMode === "vote" ? (
        <Text style={styles.detail}>📍 Lieu au vote</Text>
      ) : null}

      <View style={styles.footer}>
        <Text style={[styles.status, statusStyle(event.status)]}>
          {STATUS_LABELS[event.status]}
        </Text>
        {event.myRsvpStatus && (
          <Text style={styles.rsvp}>{RSVP_LABELS[event.myRsvpStatus]}</Text>
        )}
      </View>
    </Pressable>
  );
}

function statusStyle(status: EventEntry["status"]) {
  switch (status) {
    case "published":
      return { color: "#10b981" };
    case "cancelled":
      return { color: "#ef4444" };
    case "done":
      return { color: "#6b7280" };
    default:
      return { color: "#f59e0b" };
  }
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    center: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: c.bg,
    },
    list: { padding: 12, gap: 10 },
    sectionTitle: {
      fontSize: 14,
      fontWeight: "700",
      color: c.sub,
      textTransform: "uppercase",
      marginTop: 8,
      marginBottom: 2,
    },
    empty: {
      textAlign: "center",
      color: c.sub,
      marginTop: 48,
      paddingHorizontal: 24,
      lineHeight: 20,
    },
    errorBanner: { backgroundColor: "rgba(239,68,68,0.15)", padding: 10 },
    errorText: { color: c.danger, textAlign: "center", fontSize: 13 },
    card: {
      backgroundColor: c.card,
      borderRadius: 14,
      padding: 14,
      gap: 4,
      borderWidth: 1,
      borderColor: c.border,
      shadowColor: c.shadow,
      shadowOpacity: 0.06,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 2 },
      elevation: 2,
    },
    cardHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 8,
    },
    title: { fontSize: 16, fontWeight: "600", color: c.text, flexShrink: 1 },
    type: { fontSize: 12, color: c.sub },
    detail: { color: c.sub, fontSize: 13 },
    footer: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginTop: 6,
    },
    status: { fontSize: 12, fontWeight: "700" },
    rsvp: { fontSize: 12, color: c.sub, fontWeight: "600" },
  });
