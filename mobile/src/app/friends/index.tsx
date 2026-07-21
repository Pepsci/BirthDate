import { useCallback, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  Image,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from "react-native";
import { Stack, useRouter, useFocusEffect } from "expo-router";
import { useUnread } from "../../lib/unread-context";
import {
  FriendEntry,
  FriendRequest,
  SentItems,
  fetchFriends,
  fetchFriendRequests,
  fetchSent,
  addFriend,
  acceptRequest,
  rejectRequest,
  removeFriend,
} from "../../lib/friends";
import { fetchDates } from "../../lib/dates";
import {
  useTheme,
  useThemedStyles,
  ThemeColors,
} from "../../lib/theme-context";

type Tab = "friends" | "received" | "sent";

export default function FriendsScreen() {
  const router = useRouter();
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  const { byFriend } = useUnread();
  const [tab, setTab] = useState<Tab>("friends");
  const [friends, setFriends] = useState<FriendEntry[] | null>(null);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [sent, setSent] = useState<SentItems>({ requests: [], invitations: [] });
  // Map userId d'un ami → id de sa carte (Date), pour naviguer même si linkedDate manque.
  const [dateByUser, setDateByUser] = useState<Record<string, string>>({});
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(null);
      const [f, r, s, dates] = await Promise.all([
        fetchFriends(),
        fetchFriendRequests(),
        fetchSent(),
        fetchDates().catch(() => []),
      ]);
      setFriends(f.filter((x) => x?.friendUser?._id));
      setRequests(r.filter((x) => x?.user?._id));
      setSent({
        requests: (s?.requests ?? []).filter((x) => x?.friend),
        invitations: s?.invitations ?? [],
      });
      // Résout la carte de chaque ami via sa date liée (date.linkedUser === ami).
      const map: Record<string, string> = {};
      for (const d of dates) {
        const uid = d.linkedUser?._id;
        if (uid) map[uid] = d._id;
      }
      setDateByUser(map);
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

  const run = async (fn: () => Promise<unknown>, successMsg?: string) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      await fn();
      if (successMsg) setInfo(successMsg);
      await load();
    } catch (e: any) {
      setError(e?.message ?? "Erreur.");
    } finally {
      setBusy(false);
    }
  };

  const onAdd = () =>
    run(async () => {
      const res = await addFriend(email.trim().toLowerCase());
      setEmail("");
      if (res?.message) setInfo(res.message);
    });

  const confirmRemove = (entry: FriendEntry) => {
    Alert.alert(
      "Retirer cet ami ?",
      `${entry.friendUser.name} ${entry.friendUser.surname ?? ""} sera retiré·e de tes amis.`,
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Retirer",
          style: "destructive",
          onPress: () => run(() => removeFriend(entry.friendship._id)),
        },
      ],
    );
  };

  if (friends === null) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title: "Mes amis" }} />
        {error ? (
          <Text style={styles.error}>{error}</Text>
        ) : (
          <ActivityIndicator size="large" color={colors.primary} />
        )}
      </View>
    );
  }

  const pendingCount = requests.length;

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: "Mes amis" }} />

      {/* Ajout par email */}
      <View style={styles.addRow}>
        <TextInput placeholderTextColor={colors.placeholder}
          style={styles.input}
          placeholder="Email d'un ami à ajouter…"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        <Pressable
          style={[styles.addBtn, (!email.trim() || busy) && { opacity: 0.5 }]}
          disabled={!email.trim() || busy}
          onPress={onAdd}
        >
          <Text style={styles.addBtnText}>Inviter</Text>
        </Pressable>
      </View>

      {error && <Text style={styles.error}>{error}</Text>}
      {info && <Text style={styles.info}>{info}</Text>}

      {/* Segments */}
      <View style={styles.tabs}>
        <TabBtn
          label={`Amis (${friends.length})`}
          active={tab === "friends"}
          onPress={() => setTab("friends")}
        />
        <TabBtn
          label={`Reçues${pendingCount ? ` (${pendingCount})` : ""}`}
          active={tab === "received"}
          onPress={() => setTab("received")}
          highlight={pendingCount > 0}
        />
        <TabBtn
          label="Envoyées"
          active={tab === "sent"}
          onPress={() => setTab("sent")}
        />
      </View>

      <ScrollView
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {tab === "friends" && (
          <>
            {friends.length === 0 && (
              <Text style={styles.empty}>
                Pas encore d'amis — invite-les par email ci-dessus !
              </Text>
            )}
            {friends.map((f) => (
              <Pressable
                key={f.friendship._id}
                style={styles.row}
                onPress={() => {
                  const dateId =
                    f.linkedDate?._id || dateByUser[f.friendUser._id];
                  if (dateId) router.push(`/date/${dateId}`);
                }}
                onLongPress={() => confirmRemove(f)}
              >
                <Avatar user={f.friendUser} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>
                    {f.friendUser.name} {f.friendUser.surname ?? ""}
                  </Text>
                  <Text style={styles.muted}>{f.friendUser.email}</Text>
                </View>
                <Pressable
                  hitSlop={8}
                  style={{ flexDirection: "row", alignItems: "center" }}
                  onPress={() =>
                    router.push(
                      `/chat/${f.friendUser._id}?name=${encodeURIComponent(f.friendUser.name)}`,
                    )
                  }
                >
                  <Text style={{ fontSize: 18 }}>💬</Text>
                  {(byFriend[f.friendUser._id] ?? 0) > 0 && (
                    <View style={styles.unreadBadge}>
                      <Text style={styles.unreadText}>
                        {byFriend[f.friendUser._id]}
                      </Text>
                    </View>
                  )}
                </Pressable>
              </Pressable>
            ))}
            {friends.length > 0 && (
              <Text style={styles.hint}>
                Appui long sur un ami pour le retirer.
              </Text>
            )}
          </>
        )}

        {tab === "received" && (
          <>
            {requests.length === 0 && (
              <Text style={styles.empty}>Aucune demande en attente.</Text>
            )}
            {requests.map((r) => (
              <View key={r._id} style={styles.row}>
                <Avatar user={r.user} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>
                    {r.user.name} {r.user.surname ?? ""}
                  </Text>
                  <Text style={styles.muted}>{r.user.email}</Text>
                </View>
                <Pressable
                  style={styles.acceptBtn}
                  disabled={busy}
                  onPress={() => run(() => acceptRequest(r._id), "Ami ajouté 🎉")}
                >
                  <Text style={styles.acceptText}>✓</Text>
                </Pressable>
                <Pressable
                  style={styles.rejectBtn}
                  disabled={busy}
                  onPress={() => run(() => rejectRequest(r._id))}
                >
                  <Text style={styles.rejectText}>✕</Text>
                </Pressable>
              </View>
            ))}
          </>
        )}

        {tab === "sent" && (
          <>
            {sent.requests.length === 0 && sent.invitations.length === 0 && (
              <Text style={styles.empty}>Aucune demande envoyée.</Text>
            )}
            {sent.requests.map((r) => (
              <View key={r._id} style={styles.row}>
                <Avatar user={r.friend} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>
                    {r.friend?.name} {r.friend?.surname ?? ""}
                  </Text>
                  <Text style={styles.muted}>En attente de réponse…</Text>
                </View>
              </View>
            ))}
            {sent.invitations.map((inv) => (
              <View key={inv.email} style={styles.row}>
                <View style={styles.avatarFallback}>
                  <Text style={styles.initials}>✉️</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{inv.email}</Text>
                  <Text style={styles.muted}>
                    Invitation externe — pas encore inscrit·e
                  </Text>
                </View>
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </View>
  );
}

function TabBtn({
  label,
  active,
  onPress,
  highlight,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  highlight?: boolean;
}) {
  const styles = useThemedStyles(makeStyles);
  return (
    <Pressable
      style={[styles.tabBtn, active && styles.tabBtnActive]}
      onPress={onPress}
    >
      <Text
        style={[
          styles.tabText,
          active && styles.tabTextActive,
          highlight && !active && styles.tabTextHighlight,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function Avatar({ user }: { user: { name: string; surname?: string; avatar?: string | null } }) {
  const styles = useThemedStyles(makeStyles);
  const initials =
    `${user?.name?.[0] ?? ""}${user?.surname?.[0] ?? ""}`.toUpperCase() || "?";
  const hasAvatar = !!user?.avatar && user.avatar.trim().length > 0;
  return (
    // Le rond d'initiales sert de fond : visible même si la photo charge/échoue.
    <View style={styles.avatarFallback}>
      <Text style={styles.initials}>{initials}</Text>
      {hasAvatar && (
        <Image
          source={{ uri: user.avatar! }}
          style={StyleSheet.absoluteFill as any}
          borderRadius={20}
        />
      )}
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
    error: { color: c.danger, textAlign: "center", padding: 6 },
    info: { color: c.successStrong, textAlign: "center", padding: 6 },
    addRow: { flexDirection: "row", gap: 8, padding: 12, paddingBottom: 4 },
    input: {
      flex: 1,
      borderWidth: 1,
      borderColor: c.inputBorder,
      borderRadius: 10,
      padding: 10,
      fontSize: 14,
      backgroundColor: c.inputBg,
      color: c.text,
    },
    addBtn: {
      backgroundColor: c.primary,
      borderRadius: 10,
      paddingHorizontal: 14,
      justifyContent: "center",
    },
    addBtnText: { color: c.white, fontWeight: "600" },
    tabs: {
      flexDirection: "row",
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    tabBtn: {
      flex: 1,
      borderRadius: 10,
      paddingVertical: 8,
      alignItems: "center",
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.border,
    },
    tabBtnActive: { backgroundColor: c.primary, borderColor: c.primary },
    tabText: { fontSize: 13, fontWeight: "600", color: c.text },
    tabTextActive: { color: c.white },
    tabTextHighlight: { color: c.danger },
    list: { padding: 12, gap: 8, paddingBottom: 40 },
    empty: { textAlign: "center", color: c.sub, marginTop: 32 },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      backgroundColor: c.card,
      borderRadius: 12,
      padding: 12,
    },
    avatar: { width: 40, height: 40, borderRadius: 20 },
    avatarFallback: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: c.primarySoft,
      justifyContent: "center",
      alignItems: "center",
    },
    initials: { color: c.primaryStrong, fontWeight: "700" },
    name: { fontWeight: "600", color: c.text },
    muted: { color: c.sub, fontSize: 12 },
    hint: {
      textAlign: "center",
      color: c.faint,
      fontSize: 11,
      marginTop: 8,
    },
    acceptBtn: {
      backgroundColor: c.success,
      borderRadius: 16,
      width: 32,
      height: 32,
      justifyContent: "center",
      alignItems: "center",
    },
    acceptText: { color: c.white, fontWeight: "700" },
    rejectBtn: {
      borderWidth: 1,
      borderColor: c.danger,
      borderRadius: 16,
      width: 32,
      height: 32,
      justifyContent: "center",
      alignItems: "center",
    },
    rejectText: { color: c.danger, fontWeight: "700" },
    unreadBadge: {
      backgroundColor: c.danger,
      borderRadius: 9,
      minWidth: 18,
      height: 18,
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 4,
      marginLeft: -6,
      marginTop: -12,
    },
    unreadText: { color: c.white, fontSize: 10, fontWeight: "700" },
  });
