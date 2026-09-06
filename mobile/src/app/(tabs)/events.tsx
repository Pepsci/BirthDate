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
import OnboardingTip from "../../lib/tips";
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
import { usePersistedCollapse } from "../../lib/collapse-prefs";

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

  // Les événements passés s'accumulent sans fin et n'appellent aucune action :
  // ils sont regroupés en une seule section, repliée par défaut et placée en
  // bas. L'état replié/déplié est mémorisé (SecureStore), comme les encarts de
  // la page événement.
  const [pastOpen, setPastOpen] = usePersistedCollapse(
    "events_tab",
    "past",
    false,
  );

  // Les brouillons (formulaire quitté avant la fin) sortent de « J'organise » :
  // ce sont des créations à terminer, pas des événements en cours.
  const sections = useMemo(() => {
    const drafts = organized.filter((e) => e.status === "draft");
    const published = organized.filter((e) => e.status !== "draft");

    const upcoming = (list: EventEntry[]) =>
      list.filter((e) => !isPastEvent(e)).sort(byDateAsc);
    // Le plus récent d'abord : dans une pile d'archives, c'est celui de la
    // semaine dernière qu'on veut retrouver, pas celui d'il y a deux ans.
    const past = [...published, ...invited]
      .filter(isPastEvent)
      .sort(byDateDesc);

    return [
      { title: "📝 Brouillons à terminer", data: drafts, key: "drafts" },
      { title: "J'organise", data: upcoming(published), key: "organized" },
      { title: "Je suis invité·e", data: upcoming(invited), key: "invited" },
      {
        title: `🗄️ Événements passés (${past.length})`,
        data: pastOpen ? past : [],
        key: "past",
        // Conservé même vide de données pour que l'en-tête (et donc le bouton
        // de dépliage) reste affiché quand la section est repliée.
        count: past.length,
        collapsible: true,
      },
    ].filter((s) => s.data.length > 0 || (s as any).count > 0);
  }, [organized, invited, pastOpen]);

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

      <OnboardingTip
        id="cagnottes"
        emoji="💰"
        text="Tu peux créer une cagnotte pour financer un cadeau à plusieurs, directement depuis un événement, sans commission supplémentaire de la part de BirthReminder pour le moment."
      />

      <SectionList
        sections={sections}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.list}
        stickySectionHeadersEnabled={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        renderSectionHeader={({ section }) =>
          (section as any).collapsible ? (
            <Pressable
              style={styles.sectionToggle}
              onPress={() => setPastOpen(!pastOpen)}
              accessibilityRole="button"
              accessibilityState={{ expanded: pastOpen }}
            >
              <Text style={styles.sectionTitle}>{section.title}</Text>
              <Text style={styles.sectionChevron}>{pastOpen ? "▾" : "▸"}</Text>
            </Pressable>
          ) : (
            <Text style={styles.sectionTitle}>{section.title}</Text>
          )
        }
        ListEmptyComponent={
          // Uniquement quand il n'existe VRAIMENT aucun événement : une liste
          // sans élément visible parce que la section « passés » est repliée
          // n'est pas une liste vide, et afficher « crée ton premier
          // événement » à quelqu'un qui en a dix serait faux.
          organized.length + invited.length === 0 ? (
            <Text style={styles.empty}>
              Aucun événement pour l'instant. Crée-en un depuis le site web — il
              apparaîtra ici.
            </Text>
          ) : null
        }
        renderItem={({ item }) => <EventCard event={item} />}
      />
    </View>
  );
}

/**
 * Un événement est « passé » quand plus aucune de ses dates n'est à venir.
 *
 * ⚠️ Propriété importante : ce statut est TOUJOURS recalculé à partir des dates
 * de l'événement, jamais stocké. Un événement archivé redevient donc « à venir »
 * de lui-même dès qu'une date future réapparaît — l'organisateur repousse un
 * dîner qui n'a pas eu lieu, ou ajoute une nouvelle option à un vote périmé.
 * Le jour où on stockerait un booléen « archivé » en base, ce retour en arrière
 * cesserait de fonctionner tout seul.
 *
 * On compare au DÉBUT de la journée, pas à l'instant présent : un dîner prévu
 * ce soir à 19 h doit rester dans « à venir » toute la journée, et non basculer
 * dans les archives à 19 h 01 alors qu'il est encore en cours.
 *
 * Trois cas :
 *  - une date arrêtée (selectedDate ou fixedDate) → elle décide seule ;
 *  - pas de date arrêtée mais des options au vote → passé seulement si TOUTES
 *    sont écoulées. Une seule option future suffit à le ramener à venir ;
 *  - aucune date d'aucune sorte → jamais passé, il n'a pas encore commencé
 *    d'exister dans le temps.
 */
function isPastEvent(e: EventEntry): boolean {
  // Un événement annulé n'aura pas lieu : sa date n'a plus de sens, il rejoint
  // les archives immédiatement, quelle qu'elle soit. Le badge « Annulé » sur la
  // carte dit pourquoi il s'y trouve. S'il est rétabli (status repasse à
  // "published"), il remonte tout seul — comme le reste, c'est calculé, jamais
  // stocké.
  if (e.status === "cancelled") return true;

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const d = eventDate(e);
  if (d) return d < startOfToday;

  const options = (e.dateOptions ?? [])
    .map((iso) => new Date(iso))
    .filter((x) => !isNaN(x.getTime()));
  if (options.length === 0) return false;
  return options.every((x) => x < startOfToday);
}

/**
 * Date servant au tri quand l'événement n'a pas de date arrêtée : la plus
 * tardive des options proposées. C'est celle qui décide de son archivage, donc
 * celle qui doit le positionner dans la liste.
 */
function sortDate(e: EventEntry): Date | null {
  const d = eventDate(e);
  if (d) return d;
  const options = (e.dateOptions ?? [])
    .map((iso) => new Date(iso))
    .filter((x) => !isNaN(x.getTime()));
  if (options.length === 0) return null;
  return new Date(Math.max(...options.map((x) => x.getTime())));
}

/** Aucune date d'aucune sorte → en tête : ce sont eux qui appellent une action. */
function byDateAsc(a: EventEntry, b: EventEntry): number {
  const da = sortDate(a);
  const db = sortDate(b);
  if (!da && !db) return 0;
  if (!da) return -1;
  if (!db) return 1;
  return da.getTime() - db.getTime();
}

function byDateDesc(a: EventEntry, b: EventEntry): number {
  const da = sortDate(a);
  const db = sortDate(b);
  return (db?.getTime() ?? 0) - (da?.getTime() ?? 0);
}

function EventCard({ event }: { event: EventEntry }) {
  const router = useRouter();
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  const d = eventDate(event);
  const location =
    typeof event.fixedLocation === "string"
      ? event.fixedLocation
      : event.fixedLocation?.name ?? event.fixedLocation?.address;

  // Un brouillon n'a pas de page événement utile (pas d'invités, pas de chat) :
  // on renvoie directement dans le formulaire pour le terminer.
  const isDraft = event.status === "draft";
  const isCancelled = event.status === "cancelled";

  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        isDraft && styles.cardDraft,
        pressed && { opacity: 0.85 },
      ]}
      onPress={() =>
        router.push(
          isDraft ? `/event/edit/${event.shortId}` : `/event/${event.shortId}`,
        )
      }
    >
      <View style={styles.cardHeader}>
        <Text
          style={[styles.title, isCancelled && styles.titleCancelled]}
          numberOfLines={1}
        >
          {event.title}
        </Text>
        <Text style={styles.type}>{EVENT_TYPE_LABELS[event.type]}</Text>
      </View>

      {isCancelled && (
        <View style={styles.cancelBanner}>
          <Text style={styles.cancelBannerText} numberOfLines={2}>
            ❌ Annulé
            {event.cancellationReason ? ` — ${event.cancellationReason}` : ""}
          </Text>
        </View>
      )}

      <Text style={styles.detail}>
        📅 {d ? formatEventDate(d) : "Date au vote"}
      </Text>
      {location ? (
        <Text style={styles.detail}>📍 {location}</Text>
      ) : event.locationMode === "vote" ? (
        <Text style={styles.detail}>📍 Lieu au vote</Text>
      ) : null}

      <View style={styles.footer}>
        <Text style={[styles.status, statusStyle(event.status, colors)]}>
          {STATUS_LABELS[event.status]}
        </Text>
        {isDraft ? (
          <Text style={styles.draftHint}>Appuyer pour reprendre →</Text>
        ) : (
          event.myRsvpStatus && (
            <Text style={styles.rsvp}>{RSVP_LABELS[event.myRsvpStatus]}</Text>
          )
        )}
      </View>
    </Pressable>
  );
}

function statusStyle(status: EventEntry["status"], c: ThemeColors) {
  switch (status) {
    case "published":
      return { color: c.success };
    case "cancelled":
      return { color: c.danger };
    case "done":
      return { color: c.sub };
    default:
      return { color: c.warning };
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
    titleCancelled: { textDecorationLine: "line-through", color: c.sub },
    cancelBanner: {
      backgroundColor: c.dangerSoft ?? "rgba(239,68,68,0.12)",
      borderRadius: 8,
      paddingHorizontal: 8,
      paddingVertical: 5,
      marginTop: 2,
    },
    cancelBannerText: { color: c.danger, fontSize: 12, fontWeight: "600" },
    sectionToggle: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    sectionChevron: { color: c.sub, fontSize: 14, paddingRight: 4 },
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
    // Brouillon : liseré ambré + fond légèrement teinté, pour qu'on voie d'un
    // coup d'œil que la carte est une création inachevée.
    cardDraft: {
      borderColor: c.warning,
      borderStyle: "dashed",
      backgroundColor: c.warningSoft,
    },
    draftHint: { fontSize: 12, color: c.warningStrong, fontWeight: "700" },
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
