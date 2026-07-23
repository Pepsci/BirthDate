import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useFocusEffect } from "expo-router";
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Image,
  TextInput,
} from "react-native";
import { Image as ExpoImage } from "expo-image";
import BirthdayCountdown from "../../components/BirthdayCountdown";
import { useGuidedTour, TOURS } from "../../lib/guided-tour";
import {
  useTheme,
  useThemedStyles,
  ThemeColors,
} from "../../lib/theme-context";
import {
  DateEntry,
  fetchDates,
  daysUntil,
  currentAge,
  formatBirthday,
  formatNameday,
} from "../../lib/dates";

export default function BirthdaysScreen() {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { startTour } = useGuidedTour();
  const [dates, setDates] = useState<DateEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "friends" | "family">("all");
  const PAGE_SIZE = 20;
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const load = useCallback(async () => {
    try {
      setError(null);
      const list = await fetchDates();
      setDates(list);
    } catch (e: any) {
      setError(e?.message ?? "Erreur de chargement.");
    }
  }, []);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  // Tour guidé de première utilisation (agenda → ＋) — ne se lance qu'une fois
  useEffect(() => {
    startTour(TOURS.birthdays);
  }, [startTour]);

  // Recharge quand on revient sur l'onglet (après ajout/édition)
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  // Tri par prochaine occurrence + recherche (préfixe) + filtre ami/famille
  const sorted = useMemo(() => {
    const normalize = (str: string) =>
      str
        .toLowerCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "");
    const q = normalize(search.trim());

    return [...dates]
      .filter((d) => {
        if (filter === "friends" && !d.linkedUser) return false;
        if (filter === "family" && !d.family) return false;
        if (!q) return true;
        // Match au préfixe : "J" → tous les prénoms (ou noms) commençant par J
        return (
          normalize(d.name ?? "").startsWith(q) ||
          normalize(d.surname ?? "").startsWith(q)
        );
      })
      .sort((a, b) => {
        // Entrées sans date de naissance → en fin de liste
        const days = (e: DateEntry) => {
          const iso = birthISOOf(e);
          return iso ? daysUntil(iso) : Number.MAX_SAFE_INTEGER;
        };
        return days(a) - days(b);
      });
  }, [dates, search, filter]);

  // Réinitialise la pagination quand la recherche/filtre change
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [search, filter]);

  const visible = useMemo(
    () => sorted.slice(0, visibleCount),
    [sorted, visibleCount],
  );
  const hasMore = visibleCount < sorted.length;

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

      <View style={styles.searchBar}>
        <TextInput
          placeholderTextColor={colors.placeholder}
          style={styles.searchInput}
          placeholder="🔍 Rechercher un prénom ou un nom…"
          value={search}
          onChangeText={setSearch}
          autoCorrect={false}
        />
        {search.length > 0 && (
          <Pressable hitSlop={8} onPress={() => setSearch("")}>
            <Text style={styles.searchClear}>✕</Text>
          </Pressable>
        )}
      </View>

      <View style={styles.filterRow}>
        {(
          [
            { v: "all", l: "Tous" },
            { v: "friends", l: "👥 Amis" },
            { v: "family", l: "🏠 Famille" },
          ] as const
        ).map(({ v, l }) => (
          <Pressable
            key={v}
            style={[styles.filterChip, filter === v && styles.filterChipActive]}
            onPress={() => setFilter(v)}
          >
            <Text
              style={[
                styles.filterText,
                filter === v && styles.filterTextActive,
              ]}
            >
              {l}
            </Text>
          </Pressable>
        ))}
      </View>

      <FlatList
        data={visible}
        keyExtractor={(item) => item._id}
        numColumns={2}
        columnWrapperStyle={styles.column}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          if (hasMore) setVisibleCount((c) => c + PAGE_SIZE);
        }}
        ListFooterComponent={
          hasMore ? (
            <Pressable
              style={styles.loadMore}
              onPress={() => setVisibleCount((c) => c + PAGE_SIZE)}
            >
              <Text style={styles.loadMoreText}>
                Afficher plus ({sorted.length - visibleCount} restant
                {sorted.length - visibleCount > 1 ? "s" : ""})
              </Text>
            </Pressable>
          ) : null
        }
        ListEmptyComponent={
          <Text style={styles.empty}>
            {search || filter !== "all"
              ? "Aucun résultat pour cette recherche."
              : "Aucune date pour l'instant. Ajoute ton premier anniversaire avec le bouton ＋ !"}
          </Text>
        }
        renderItem={({ item }) => <BirthdayCard entry={item} />}
      />
    </View>
  );
}

/** Date d'anniversaire : sur l'entrée manuelle, sinon sur l'ami lié. */
function birthISOOf(entry: DateEntry): string | null {
  return entry.date || entry.linkedUser?.birthDate || null;
}

function BirthdayCard({ entry }: { entry: DateEntry }) {
  const router = useRouter();
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  const birthISO = birthISOOf(entry);
  const days = birthISO ? daysUntil(birthISO) : null;
  const age = birthISO ? currentAge(birthISO) : null;
  const isToday = days === 0;
  const avatar = entry.linkedUser?.avatar;

  // Nom/prénom : sur l'entrée, sinon sur l'ami lié.
  const name = entry.name || entry.linkedUser?.name || "";
  const surname = entry.surname || entry.linkedUser?.surname || "";
  const initials =
    `${name[0] ?? ""}${surname[0] ?? ""}`.toUpperCase() || "?";

  // Bandeau d'urgence en haut à droite : « Demain » (J-1) ou « J-X »
  // quand il reste moins d'une semaine. (aujourd'hui → déjà signalé plus bas)
  const soon = days !== null && days >= 1 && days <= 7;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        isToday && styles.cardToday,
        pressed && { opacity: 0.85 },
      ]}
      onPress={() => router.push(`/date/${entry._id}`)}
    >
      {soon && (
        <View
          style={[
            styles.soonBadge,
            days! <= 2 ? styles.soonBadgeUrgent : styles.soonBadgeNormal,
          ]}
        >
          <Text style={styles.soonBadgeText}>
            {days === 1 ? "Demain" : `J-${days}`}
          </Text>
        </View>
      )}

      <View style={styles.avatarFallback}>
        <Text style={styles.avatarInitials}>{initials}</Text>
        {!!avatar && avatar.trim().length > 0 && (
          <ExpoImage
            source={{ uri: avatar }}
            style={[StyleSheet.absoluteFill as any, { borderRadius: 28 }]}
            contentFit="cover"
          />
        )}
      </View>

      <Text style={styles.name} numberOfLines={1}>
        {name} {surname}
      </Text>

      <View style={styles.nameRow}>
        {entry.linkedUser && <Badge label="AMI" color={colors.primary} />}
        {entry.family && <Badge label="FAMILLE" color={colors.warning} />}
      </View>

      {birthISO && (
        <Text style={styles.detail}>
          🎂 {formatBirthday(birthISO)}
          {age !== null ? ` · ${age} ans` : ""}
        </Text>
      )}
      {entry.nameday || entry.linkedUser?.nameday ? (
        <Text style={styles.detail}>
          🎉 {formatNameday(entry.nameday ?? entry.linkedUser!.nameday!)}
        </Text>
      ) : (
        // Espace réservé pour aligner les cartes sans fête
        <Text style={styles.detail}>{" "}</Text>
      )}

      {birthISO &&
        (isToday ? (
          <View style={styles.countdownToday}>
            <Text style={styles.countdownTodayText}>Aujourd'hui 🎂</Text>
          </View>
        ) : (
          <BirthdayCountdown iso={birthISO} />
        ))}
    </Pressable>
  );
}

function Badge({ label, color }: { label: string; color: string }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={[styles.badge, { backgroundColor: color }]}>
      <Text style={styles.badgeText}>{label}</Text>
    </View>
  );
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
    logout: { color: c.danger, fontWeight: "600" },
    list: { padding: 12, paddingTop: 4, gap: 10 },
    searchBar: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: c.card,
      borderRadius: 12,
      marginHorizontal: 12,
      marginTop: 10,
      paddingRight: 12,
      borderWidth: 1,
      borderColor: c.border,
    },
    searchInput: {
      flex: 1,
      padding: 11,
      fontSize: 15,
      color: c.text,
    },
    searchClear: { color: c.faint, fontWeight: "700", fontSize: 14 },
    filterRow: {
      flexDirection: "row",
      gap: 8,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    filterChip: {
      flex: 1,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 16,
      paddingVertical: 7,
      alignItems: "center",
      backgroundColor: c.card,
    },
    filterChipActive: { backgroundColor: c.primary, borderColor: c.primary },
    filterText: { fontSize: 13, fontWeight: "600", color: c.sub },
    filterTextActive: { color: c.white },
    empty: {
      textAlign: "center",
      color: c.sub,
      marginTop: 48,
      paddingHorizontal: 24,
      lineHeight: 20,
    },
    errorBanner: {
      backgroundColor: "rgba(239,68,68,0.15)",
      padding: 10,
    },
    errorText: { color: c.danger, textAlign: "center", fontSize: 13 },
    column: { gap: 10 },
    card: {
      flex: 1,
      alignItems: "center",
      backgroundColor: c.card,
      borderRadius: 14,
      padding: 12,
      gap: 4,
      borderWidth: 1,
      borderColor: c.border,
      shadowColor: c.shadow,
      shadowOpacity: 0.06,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 2 },
      elevation: 2,
    },
    cardToday: {
      borderWidth: 1.5,
      borderColor: c.primary,
    },
    avatar: { width: 56, height: 56, borderRadius: 28 },
    avatarFallback: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: c.primarySoft,
      justifyContent: "center",
      alignItems: "center",
    },
    avatarInitials: { color: c.primary, fontWeight: "700", fontSize: 16 },
    nameRow: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 18 },
    name: {
      fontSize: 15,
      fontWeight: "700",
      color: c.text,
      textAlign: "center",
      marginTop: 2,
    },
    detail: { color: c.sub, fontSize: 12, textAlign: "center" },
    badge: {
      borderRadius: 6,
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    badgeText: { color: c.white, fontSize: 10, fontWeight: "700" },
    soonBadge: {
      position: "absolute",
      top: 8,
      right: 8,
      zIndex: 2,
      borderRadius: 8,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    soonBadgeNormal: { backgroundColor: c.primary },
    soonBadgeUrgent: { backgroundColor: c.warning },
    soonBadgeText: { color: c.white, fontSize: 11, fontWeight: "800" },
    countdownToday: {
      alignSelf: "stretch",
      alignItems: "center",
      marginTop: 8,
      paddingTop: 8,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.border,
    },
    countdownTodayText: { color: c.success, fontWeight: "800", fontSize: 15 },
    loadMore: {
      marginTop: 6,
      marginHorizontal: 24,
      paddingVertical: 11,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: c.primary,
      alignItems: "center",
      backgroundColor: c.card,
    },
    loadMoreText: { color: c.primary, fontWeight: "700", fontSize: 14 },
  });
