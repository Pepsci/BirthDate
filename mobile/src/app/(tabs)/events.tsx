import { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  SectionList,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Pressable,
  Alert,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { useGuidedTour, TOURS } from "../../lib/guided-tour";
import OnboardingTip from "../../lib/tips";
import {
  EventEntry,
  fetchMyEvents,
  deleteEvent,
  eventDate,
  formatEventDate,
  EVENT_TYPE_LABELS,
  STATUS_LABELS,
  RSVP_LABELS,
} from "../../lib/events";
import OfflineBanner from "../../components/OfflineBanner";
import BirthdayCountdown from "../../components/BirthdayCountdown";
import {
  useTheme,
  useThemedStyles,
  ThemeColors,
} from "../../lib/theme-context";
import { usePersistedCollapse } from "../../lib/collapse-prefs";
import { readingPane } from "../../lib/layout";

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
      <OfflineBanner />
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
        renderItem={({ item }) => (
          <EventCard event={item} onDeleted={load} />
        )}
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

/** Emoji et couleur d'accent par type d'événement. */
const TYPE_VISUAL: Record<
  EventEntry["type"],
  { emoji: string; color: keyof ThemeColors; soft: keyof ThemeColors }
> = {
  birthday: { emoji: "🎂", color: "primary", soft: "primarySoft" },
  party: { emoji: "🎉", color: "accent", soft: "accentSoft" },
  dinner: { emoji: "🍽️", color: "warning", soft: "warningSoft" },
  other: { emoji: "📌", color: "success", soft: "successSoft" },
};

/** Jours calendaires restants avant `d` (0 = aujourd'hui, négatif = passé). */
function daysUntilDate(d: Date): number {
  const today = new Date();
  const a = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const b = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

function EventCard({
  event,
  onDeleted,
}: {
  event: EventEntry;
  onDeleted: () => void;
}) {
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

  // ⚠️ Un brouillon ouvre directement le formulaire, jamais la page
  // événement — or c'est là que se trouvaient Annuler et Supprimer. Un
  // brouillon était donc impossible à supprimer. Le bouton vit sur la carte.
  const confirmDeleteDraft = () => {
    Alert.alert(
      "Supprimer ce brouillon ?",
      `« ${event.title || "Sans titre"} » sera supprimé définitivement.`,
      [
        { text: "Garder", style: "cancel" },
        {
          text: "Supprimer",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteEvent(event.shortId);
              onDeleted();
            } catch (e: any) {
              Alert.alert(
                "Suppression impossible",
                e?.message ?? "Réessaie dans un instant.",
              );
            }
          },
        },
      ],
    );
  };

  const visual = TYPE_VISUAL[event.type] ?? TYPE_VISUAL.other;
  const accent = colors[visual.color] as string;
  const accentSoft = colors[visual.soft] as string;
  const days = d ? daysUntilDate(d) : null;
  const isLive = !isDraft && !isCancelled && event.status !== "done";
  // Compte à rebours : date fixée, à venir, événement actif
  const showCountdown = isLive && !!d && d.getTime() > Date.now();
  // Badge d'urgence, comme sur les cartes d'anniversaire
  const soonLabel =
    isLive && days !== null && days >= 0 && days <= 7
      ? days === 0
        ? "Aujourd'hui"
        : days === 1
          ? "Demain"
          : `J-${days}`
      : null;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        isDraft && styles.cardDraft,
        isCancelled && styles.cardCancelled,
        pressed && { opacity: 0.85 },
      ]}
      onPress={() =>
        router.push(
          isDraft ? `/event/edit/${event.shortId}` : `/event/${event.shortId}`,
        )
      }
    >
      {/* Liseré de couleur du type d'événement */}
      <View style={[styles.accentBar, { backgroundColor: accent }]} />

      <View style={styles.cardBody}>
        <View style={styles.cardHeader}>
          <View style={[styles.emojiBubble, { backgroundColor: accentSoft }]}>
            <Text style={styles.emoji}>{visual.emoji}</Text>
          </View>
          <View style={styles.headerText}>
            <Text
              style={[styles.title, isCancelled && styles.titleCancelled]}
              numberOfLines={2}
            >
              {event.title || "Sans titre"}
            </Text>
            <Text style={[styles.type, { color: accent }]}>
              {EVENT_TYPE_LABELS[event.type].replace(/^\S+\s/, "")}
              {typeof event.forPerson === "object" && event.forPerson?.name
                ? ` · pour ${event.forPerson.name}`
                : ""}
            </Text>
          </View>
          {soonLabel && (
            <View
              style={[
                styles.soonBadge,
                days! <= 2 ? styles.soonBadgeUrgent : styles.soonBadgeNormal,
              ]}
            >
              <Text style={styles.soonBadgeText}>{soonLabel}</Text>
            </View>
          )}
        </View>

        {isCancelled && (
          <View style={styles.cancelBanner}>
            <Text style={styles.cancelBannerText} numberOfLines={2}>
              ❌ Annulé
              {event.cancellationReason ? ` — ${event.cancellationReason}` : ""}
            </Text>
          </View>
        )}

        <View style={styles.infoBlock}>
          <Text style={styles.detail}>
            📅 {d ? formatEventDate(d) : "Date au vote"}
          </Text>
          {location ? (
            <Text style={styles.detail} numberOfLines={1}>
              📍 {location}
            </Text>
          ) : event.locationMode === "vote" ? (
            <Text style={styles.detail}>📍 Lieu au vote</Text>
          ) : null}
        </View>

        {showCountdown && <BirthdayCountdown until={d!} />}

        <View style={styles.footer}>
          <Text style={[styles.status, statusStyle(event.status, colors)]}>
            {STATUS_LABELS[event.status]}
          </Text>
          {isDraft ? (
            <View style={styles.draftActions}>
              <Pressable
                onPress={confirmDeleteDraft}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Supprimer ce brouillon"
              >
                <Text style={styles.draftDelete}>🗑️ Supprimer</Text>
              </Pressable>
              <Text style={styles.draftHint}>Reprendre →</Text>
            </View>
          ) : (
            event.myRsvpStatus && (
              <View style={styles.rsvpPill}>
                <Text style={styles.rsvp}>{RSVP_LABELS[event.myRsvpStatus]}</Text>
              </View>
            )
          )}
        </View>
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
    list: { padding: 12, gap: 10, ...readingPane },
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
      flexDirection: "row",
      backgroundColor: c.card,
      borderRadius: 16,
      overflow: "hidden",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      // Même ombre que les cartes d'anniversaire (halo clair en thème sombre)
      shadowColor: c.cardShadow,
      shadowOpacity: c.cardShadowOpacity,
      shadowRadius: c.cardShadowRadius,
      shadowOffset: { width: 0, height: 3 },
      elevation: 3,
    },
    accentBar: { width: 5 },
    cardBody: { flex: 1, padding: 14, gap: 8 },
    cardCancelled: { opacity: 0.75 },
    // Brouillon : liseré ambré + fond légèrement teinté, pour qu'on voie d'un
    // coup d'œil que la carte est une création inachevée.
    cardDraft: {
      borderColor: c.warning,
      borderStyle: "dashed",
      backgroundColor: c.warningSoft,
    },
    draftHint: { fontSize: 12, color: c.warningStrong, fontWeight: "700" },
    draftActions: { flexDirection: "row", alignItems: "center", gap: 16 },
    draftDelete: { fontSize: 12, color: c.danger, fontWeight: "700" },
    cardHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    emojiBubble: {
      width: 46,
      height: 46,
      borderRadius: 23,
      alignItems: "center",
      justifyContent: "center",
    },
    emoji: { fontSize: 24 },
    headerText: { flex: 1, gap: 2 },
    title: { fontSize: 17, fontWeight: "700", color: c.text },
    type: { fontSize: 12, fontWeight: "700" },
    soonBadge: {
      alignSelf: "flex-start",
      borderRadius: 8,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    soonBadgeNormal: { backgroundColor: c.primary },
    soonBadgeUrgent: { backgroundColor: c.warning },
    soonBadgeText: { color: c.white, fontSize: 11, fontWeight: "800" },
    infoBlock: { gap: 3 },
    detail: { color: c.sub, fontSize: 13 },
    footer: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginTop: 2,
    },
    status: { fontSize: 12, fontWeight: "700" },
    rsvpPill: {
      backgroundColor: c.primarySoft,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 3,
    },
    rsvp: { fontSize: 12, color: c.primaryStrong, fontWeight: "700" },
  });
