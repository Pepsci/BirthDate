import { useCallback, useState } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { useAuth } from "../../lib/auth-context";
import OnboardingTip from "../../lib/tips";
import { useUnread } from "../../lib/unread-context";
import {
  ConversationSummary,
  fetchConversations,
} from "../../lib/conversations";
import { timeAgo } from "../../lib/notifications";
import Avatar from "../../components/Avatar";
import {
  useTheme,
  useThemedStyles,
  ThemeColors,
} from "../../lib/theme-context";

export default function ChatsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { byFriend } = useUnread();
  const [convs, setConvs] = useState<ConversationSummary[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      setConvs(await fetchConversations());
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

  if (!convs) {
    return (
      <View style={styles.center}>
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
      <OnboardingTip
        id="chats"
        emoji="🔒"
        text="Tes messages sont chiffrés de bout en bout : personne d'autre que toi et ton ami ne peut les lire. Ajoute des amis depuis Profil → Mes amis."
      />
      {error && <Text style={styles.error}>{error}</Text>}
      <FlatList
        data={convs}
        keyExtractor={(c) => c._id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <Text style={styles.empty}>
            Aucune conversation. Ouvre le chat d'un ami depuis sa fiche ou
            l'écran Mes amis !
          </Text>
        }
        renderItem={({ item }) => {
          const other = item.participants.find((p) => p._id !== user?._id);
          if (!other) return null;
          const unread = byFriend[other._id] ?? item.unreadCount ?? 0;
          const preview = item.lastMessage
            ? item.lastMessage.isEncrypted
              ? "🔒 Message"
              : item.lastMessage.content
            : "Aucun message";
          const when =
            item.lastMessageAt ?? item.lastMessage?.createdAt ?? null;
          return (
            <Pressable
              style={({ pressed }) => [styles.row, pressed && { opacity: 0.8 }]}
              onPress={() =>
                router.push(
                  `/chat/${other._id}?name=${encodeURIComponent(other.name)}&avatar=${encodeURIComponent(other.avatar ?? "")}`,
                )
              }
            >
              <Avatar
                uri={other.avatar}
                name={other.name}
                surname={other.surname}
                size={46}
              />
              <View style={{ flex: 1 }}>
                <View style={styles.topLine}>
                  <Text style={styles.name} numberOfLines={1}>
                    {other.name} {other.surname ?? ""}
                  </Text>
                  {when && <Text style={styles.time}>{timeAgo(when)}</Text>}
                </View>
                <Text
                  style={[styles.preview, unread > 0 && styles.previewUnread]}
                  numberOfLines={1}
                >
                  {preview}
                </Text>
              </View>
              {unread > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{unread}</Text>
                </View>
              )}
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
    list: { padding: 12, gap: 8 },
    empty: {
      textAlign: "center",
      color: c.sub,
      marginTop: 48,
      paddingHorizontal: 24,
      lineHeight: 20,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      backgroundColor: c.card,
      borderRadius: 12,
      padding: 12,
      borderWidth: 1,
      borderColor: c.border,
    },
    avatar: {
      width: 46,
      height: 46,
      borderRadius: 23,
      backgroundColor: c.primarySoft,
      justifyContent: "center",
      alignItems: "center",
    },
    initials: { color: c.primary, fontWeight: "700", fontSize: 15 },
    topLine: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 8,
    },
    name: { fontWeight: "600", color: c.text, fontSize: 15, flexShrink: 1 },
    time: { color: c.faint, fontSize: 11 },
    preview: { color: c.sub, fontSize: 13, marginTop: 1 },
    previewUnread: { color: c.text, fontWeight: "600" },
    badge: {
      backgroundColor: c.danger,
      borderRadius: 10,
      minWidth: 20,
      height: 20,
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 5,
    },
    badgeText: { color: c.white, fontSize: 11, fontWeight: "700" },
  });
