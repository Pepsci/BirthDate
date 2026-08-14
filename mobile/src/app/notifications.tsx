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
import {
  useTheme,
  useThemedStyles,
  ThemeColors,
} from "../lib/theme-context";

export default function NotificationsScreen() {
  const router = useRouter();
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  const { refreshNotifs } = useUnread();
  const [items, setItems] = useState<AppNotification[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Cartes dont le texte complet est affiché (par défaut : tronqué sur 2
  // lignes). Un bouton par carte permet de dérouler/replier, comme sur le web.
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

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
          <ActivityIndicator size="large" color={colors.primary} />
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
          const expanded = expandedIds.has(item._id);
          // Repère grossier pour savoir si le texte risque d'être tronqué
          // sur 2 lignes et si un bouton déplier/replier est utile.
          const maybeTruncated = text.length > 60;
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
                  numberOfLines={expanded ? undefined : 2}
                >
                  {text}
                </Text>
                <View style={styles.rowFooter}>
                  <Text style={styles.time}>{timeAgo(item.createdAt)}</Text>
                  {maybeTruncated && (
                    <Pressable
                      hitSlop={8}
                      onPress={() => toggleExpanded(item._id)}
                    >
                      <Text style={styles.expandBtn}>
                        {expanded ? "▾ Réduire" : "▸ Déplier"}
                      </Text>
                    </Pressable>
                  )}
                </View>
              </View>
              <View style={styles.rowActions}>
                {!item.read && <View style={styles.dot} />}
                <Pressable
                  hitSlop={10}
                  onPress={(e) => {
                    e.stopPropagation();
                    remove(item);
                  }}
                >
                  <Text style={styles.deleteBtn}>✕</Text>
                </Pressable>
              </View>
            </Pressable>
          );
        }}
      />
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
    headerActions: { flexDirection: "row", alignItems: "center", gap: 16 },
    readAll: { color: c.primary, fontWeight: "600", fontSize: 13 },
    deleteAll: { color: c.danger, fontWeight: "600", fontSize: 13 },
    list: { padding: 12, gap: 8, paddingBottom: 8 },
    empty: { textAlign: "center", color: c.sub, marginTop: 48 },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      backgroundColor: c.card,
      borderRadius: 12,
      padding: 12,
    },
    rowUnread: { backgroundColor: c.primarySoft },
    emoji: { fontSize: 22 },
    text: { color: c.text, fontSize: 14, lineHeight: 19 },
    textUnread: { color: c.text, fontWeight: "600" },
    rowFooter: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      marginTop: 2,
    },
    time: { color: c.faint, fontSize: 11 },
    expandBtn: { color: c.primary, fontSize: 11, fontWeight: "700" },
    rowActions: {
      alignItems: "center",
      gap: 8,
    },
    dot: {
      width: 9,
      height: 9,
      borderRadius: 5,
      backgroundColor: c.primary,
    },
    deleteBtn: {
      color: c.faint,
      fontSize: 16,
      fontWeight: "700",
      padding: 2,
    },
    hint: {
      textAlign: "center",
      color: c.faint,
      fontSize: 11,
      paddingBottom: 10,
    },
  });
