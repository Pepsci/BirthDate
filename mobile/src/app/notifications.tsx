import { useCallback, useState } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Stack, useRouter, useFocusEffect } from "expo-router";
import {
  AppNotification,
  fetchNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
  deleteAllNotifications,
  notifDisplay,
  timeAgo,
} from "../lib/notifications";
import { useUnread } from "../lib/unread-context";
import { webLinkToMobileRoute } from "../lib/push";

export default function NotificationsScreen() {
  const router = useRouter();
  const { refreshNotifs } = useUnread();
  const [items, setItems] = useState<AppNotification[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const { notifications } = await fetchNotifications();
      setItems(notifications);
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

  const open = async (n: AppNotification) => {
    if (!n.read) {
      markNotificationRead(n._id)
        .then(refreshNotifs)
        .catch(() => {});
      setItems(
        (prev) =>
          prev?.map((x) => (x._id === n._id ? { ...x, read: true } : x)) ??
          prev,
      );
    }
    const route = webLinkToMobileRoute(n.link);
    router.push(route as never);
  };

  const readAll = async () => {
    try {
      await markAllNotificationsRead();
      setItems((prev) => prev?.map((x) => ({ ...x, read: true })) ?? prev);
      refreshNotifs();
    } catch (e: any) {
      setError(e?.message ?? "Erreur.");
    }
  };

  const removeAll = () => {
    Alert.alert(
      "Tout supprimer ?",
      "Toutes tes notifications seront définitivement supprimées.",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Tout supprimer",
          style: "destructive",
          onPress: async () => {
            const prev = items;
            setItems([]); // optimiste
            try {
              await deleteAllNotifications();
              refreshNotifs();
            } catch (e: any) {
              setItems(prev); // rollback
              setError(e?.message ?? "Erreur.");
            }
          },
        },
      ],
    );
  };

  const remove = async (n: AppNotification) => {
    try {
      await deleteNotification(n._id);
      setItems((prev) => prev?.filter((x) => x._id !== n._id) ?? prev);
      refreshNotifs();
    } catch {
      // silencieux
    }
  };

  if (!items) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title: "Notifications" }} />
        {error ? (
          <Text style={styles.error}>{error}</Text>
        ) : (
          <ActivityIndicator size="large" color="#3b82f6" />
        )}
      </View>
    );
  }

  const hasUnread = items.some((n) => !n.read);

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: "Notifications",
          headerRight: () =>
            items.length > 0 ? (
              <View style={styles.headerActions}>
                {hasUnread && (
                  <Pressable onPress={readAll} hitSlop={10}>
                    <Text style={styles.readAll}>Tout lire</Text>
                  </Pressable>
                )}
                <Pressable onPress={removeAll} hitSlop={10}>
                  <Text style={styles.deleteAll}>Tout supprimer</Text>
                </Pressable>
              </View>
            ) : null,
        }}
      />

      {error && <Text style={styles.error}>{error}</Text>}

      <FlatList
        data={items}
        keyExtractor={(n) => n._id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <Text style={styles.empty}>
            Aucune notification pour l'instant. 🔕
          </Text>
        }
        renderItem={({ item }) => {
          const { emoji, text } = notifDisplay(item);
          return (
            <Pressable
              style={[styles.row, !item.read && styles.rowUnread]}
              onPress={() => open(item)}
              onLongPress={() => remove(item)}
            >
              <Text style={styles.emoji}>{emoji}</Text>
              <View style={{ flex: 1 }}>
                <Text
                  style={[styles.text, !item.read && styles.textUnread]}
                  numberOfLines={2}
                >
                  {text}
                </Text>
                <Text style={styles.time}>{timeAgo(item.createdAt)}</Text>
              </View>
              {!item.read && <View style={styles.dot} />}
            </Pressable>
          );
        }}
      />
      <Text style={styles.hint}>Appui long pour supprimer une notification.</Text>
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
  error: { color: "#b91c1c", textAlign: "center", padding: 6 },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 16 },
  readAll: { color: "#3b82f6", fontWeight: "600", fontSize: 13 },
  deleteAll: { color: "#ef4444", fontWeight: "600", fontSize: 13 },
  list: { padding: 12, gap: 8, paddingBottom: 8 },
  empty: { textAlign: "center", color: "#6b7280", marginTop: 48 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
  },
  rowUnread: { backgroundColor: "#eff6ff" },
  emoji: { fontSize: 22 },
  text: { color: "#374151", fontSize: 14, lineHeight: 19 },
  textUnread: { color: "#111827", fontWeight: "600" },
  time: { color: "#9ca3af", fontSize: 11, marginTop: 2 },
  dot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: "#3b82f6",
  },
  hint: {
    textAlign: "center",
    color: "#c4c9d0",
    fontSize: 11,
    paddingBottom: 10,
  },
});
