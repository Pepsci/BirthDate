import { useCallback, useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { Stack, useFocusEffect, useRouter } from "expo-router";
import {
  SharedInvitation,
  SharedListPending,
  fetchSharedInvitations,
  fetchListsSharedWithMe,
  acceptSharedInvitation,
  declineSharedInvitation,
} from "../lib/sharedGifts";
import { DateEntry, fetchDates } from "../lib/dates";
import BottomSheet from "../components/BottomSheet";
import {
  useTheme,
  useThemedStyles,
  ThemeColors,
} from "../lib/theme-context";

export default function SharedInvitesScreen() {
  const styles = useThemedStyles(makeStyles);
  const router = useRouter();
  const { colors } = useTheme();
  const [invites, setInvites] = useState<SharedInvitation[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Sélection de carte pour accepter
  const [accepting, setAccepting] = useState<SharedInvitation | null>(null);
  const [dates, setDates] = useState<DateEntry[]>([]);
  // Listes qu'on m'a partagées en lecture et que je n'ai pas encore posées sur
  // une carte. Sans cette liste, supprimer la notification les rendrait
  // définitivement introuvables.
  const [pending, setPending] = useState<SharedListPending[]>([]);

  const load = useCallback(async () => {
    try {
      setError(null);
      const [inv, shared] = await Promise.all([
        fetchSharedInvitations(),
        fetchListsSharedWithMe().catch(() => []),
      ]);
      setInvites(inv);
      setPending(shared);
    } catch (e: any) {
      setError(e?.message ?? "Erreur de chargement.");
    }
  }, []);

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

  const openAccept = async (inv: SharedInvitation) => {
    setAccepting(inv);
    try {
      setDates(await fetchDates());
    } catch {
      setDates([]);
    }
  };

  const confirmAccept = async (dateId: string) => {
    if (!accepting || busy) return;
    setBusy(true);
    try {
      await acceptSharedInvitation(accepting._id, dateId);
      setAccepting(null);
      await load();
    } catch (e: any) {
      setError(e?.message ?? "Erreur.");
    } finally {
      setBusy(false);
    }
  };

  const decline = async (inv: SharedInvitation) => {
    if (busy) return;
    setBusy(true);
    try {
      await declineSharedInvitation(inv._id);
      await load();
    } catch (e: any) {
      setError(e?.message ?? "Erreur.");
    } finally {
      setBusy(false);
    }
  };

  if (!invites) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title: "Listes communes" }} />
        {error ? (
          <Text style={styles.error}>{error}</Text>
        ) : (
          <ActivityIndicator size="large" color={colors.primary} />
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: "Listes communes" }} />
      {error && <Text style={styles.error}>{error}</Text>}

      <FlatList
        data={invites}
        keyExtractor={(i) => i._id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListHeaderComponent={
          pending.length > 0 ? (
            <View style={{ marginBottom: 8 }}>
              <Text style={styles.sectionTitle}>Listes partagées avec toi</Text>
              {pending.map((l) => (
                <Pressable
                  key={l._id}
                  style={styles.card}
                  onPress={() => router.push(`/shared-list/${l._id}/attach`)}
                >
                  <Text style={styles.cardText}>
                    <Text style={styles.bold}>
                      {l.from
                        ? `${l.from.name} ${l.from.surname ?? ""}`.trim()
                        : "Quelqu'un"}
                    </Text>{" "}
                    t'a partagé une liste
                    {l.label ? ` pour ${l.label}` : ""} — {l.giftCount} idée
                    {l.giftCount > 1 ? "s" : ""}.
                  </Text>
                  <Text style={styles.pendingHint}>
                    Appuie pour l'ajouter à une carte et pouvoir réserver.
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null
        }
        ListEmptyComponent={
          pending.length > 0 ? null : (
            <Text style={styles.empty}>Aucune invitation en attente.</Text>
          )
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.cardText}>
              <Text style={styles.bold}>
                {item.fromUser?.name} {item.fromUser?.surname ?? ""}
              </Text>{" "}
              veut créer une liste de cadeaux commune
              {item.label ? ` pour ${item.label}` : ""}.
            </Text>
            <View style={styles.actions}>
              <Pressable
                style={styles.declineBtn}
                disabled={busy}
                onPress={() => decline(item)}
              >
                <Text style={styles.declineText}>Refuser</Text>
              </Pressable>
              <Pressable
                style={styles.acceptBtn}
                disabled={busy}
                onPress={() => openAccept(item)}
              >
                <Text style={styles.acceptText}>Accepter</Text>
              </Pressable>
            </View>
          </View>
        )}
      />

      <BottomSheet visible={!!accepting} onClose={() => setAccepting(null)}>
        <Text style={styles.sheetTitle}>Associer à quelle carte ?</Text>
        <Text style={styles.sheetSub}>
          Choisis la carte anniversaire à relier à cette liste commune.
        </Text>
        {dates.map((d) => (
          <Pressable
            key={d._id}
            style={styles.dateRow}
            disabled={busy}
            onPress={() => confirmAccept(d._id)}
          >
            <Text style={styles.dateName}>
              {(d.name || d.linkedUser?.name) ?? "?"}{" "}
              {(d.surname || d.linkedUser?.surname) ?? ""}
            </Text>
            <Text style={styles.dateBadge}>
              {d.linkedUser ? "Ami" : d.family ? "Famille" : "Manuelle"}
            </Text>
          </Pressable>
        ))}
        {dates.length === 0 && (
          <Text style={styles.empty}>Aucune carte disponible.</Text>
        )}
      </BottomSheet>
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
  error: { color: c.danger, textAlign: "center", padding: 8 },
  list: { padding: 12, gap: 10 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: c.sub,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  pendingHint: { fontSize: 12, color: c.primary, marginTop: 6 },
  empty: { textAlign: "center", color: c.sub, marginTop: 32 },
  card: {
    backgroundColor: c.card,
    borderRadius: 12,
    padding: 14,
    gap: 12,
    borderWidth: 1,
    borderColor: c.border,
  },
  cardText: { color: c.text, fontSize: 14, lineHeight: 20 },
  bold: { fontWeight: "800", color: c.text },
  actions: { flexDirection: "row", gap: 10, justifyContent: "flex-end" },
  declineBtn: {
    borderWidth: 1,
    borderColor: c.borderStrong,
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 16,
  },
  declineText: { color: c.sub, fontWeight: "600" },
  acceptBtn: {
    backgroundColor: c.primary,
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 18,
  },
  acceptText: { color: c.white, fontWeight: "700" },
  sheetTitle: { fontSize: 18, fontWeight: "800", color: c.text },
  sheetSub: { color: c.sub, fontSize: 13, marginTop: 4, marginBottom: 12 },
  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.border,
  },
  dateName: { fontSize: 15, fontWeight: "600", color: c.text },
  dateBadge: { fontSize: 12, color: c.sub },
});
