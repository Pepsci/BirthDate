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
import { Stack, useFocusEffect } from "expo-router";
import {
  SharedInvitation,
  fetchSharedInvitations,
  acceptSharedInvitation,
  declineSharedInvitation,
} from "../lib/sharedGifts";
import { DateEntry, fetchDates } from "../lib/dates";
import BottomSheet from "../components/BottomSheet";

export default function SharedInvitesScreen() {
  const [invites, setInvites] = useState<SharedInvitation[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Sélection de carte pour accepter
  const [accepting, setAccepting] = useState<SharedInvitation | null>(null);
  const [dates, setDates] = useState<DateEntry[]>([]);

  const load = useCallback(async () => {
    try {
      setError(null);
      setInvites(await fetchSharedInvitations());
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
          <ActivityIndicator size="large" color="#3b82f6" />
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
        ListEmptyComponent={
          <Text style={styles.empty}>Aucune invitation en attente.</Text>
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f9fafb",
  },
  error: { color: "#b91c1c", textAlign: "center", padding: 8 },
  list: { padding: 12, gap: 10 },
  empty: { textAlign: "center", color: "#6b7280", marginTop: 32 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    gap: 12,
    borderWidth: 1,
    borderColor: "#eef2f7",
  },
  cardText: { color: "#374151", fontSize: 14, lineHeight: 20 },
  bold: { fontWeight: "800", color: "#111827" },
  actions: { flexDirection: "row", gap: 10, justifyContent: "flex-end" },
  declineBtn: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 16,
  },
  declineText: { color: "#6b7280", fontWeight: "600" },
  acceptBtn: {
    backgroundColor: "#3b82f6",
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 18,
  },
  acceptText: { color: "#fff", fontWeight: "700" },
  sheetTitle: { fontSize: 18, fontWeight: "800", color: "#111827" },
  sheetSub: { color: "#6b7280", fontSize: 13, marginTop: 4, marginBottom: 12 },
  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#eef2f7",
  },
  dateName: { fontSize: 15, fontWeight: "600", color: "#111827" },
  dateBadge: { fontSize: 12, color: "#6b7280" },
});
