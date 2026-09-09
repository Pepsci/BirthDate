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
import { useRouter, useFocusEffect } from "expo-router";
import { useAuth } from "../../lib/auth-context";
import OnboardingTip from "../../lib/tips";
import { useUnread } from "../../lib/unread-context";
import {
  ConversationSummary,
  fetchConversations,
  deleteConversation,
} from "../../lib/conversations";
import { EventChatSummary, fetchEventChats } from "../../lib/events";
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
  const [deletingId, setDeletingId] = useState<string | null>(null);
  /**
   * Discussions d'événement. Elles n'apparaissaient nulle part ici : on ne
   * pouvait les retrouver qu'en rouvrant l'événement, alors que c'est
   * précisément cet écran qu'on ouvre pour lire ses messages.
   *
   * Elles vivent dans un onglet à part plutôt que mêlées aux conversations
   * privées : ce ne sont pas les mêmes objets — l'une se supprime, l'autre
   * appartient à un événement — et les confondre rendrait l'appui long
   * ambigu.
   */
  const [eventChats, setEventChats] = useState<EventChatSummary[]>([]);
  const [tab, setTab] = useState<"dm" | "events">("dm");

  const load = useCallback(async () => {
    try {
      setError(null);
      const [dm, evts] = await Promise.all([
        fetchConversations(),
        // Une erreur ici ne doit pas vider la liste des conversations
        // privées : les deux sources sont indépendantes.
        fetchEventChats().catch(() => []),
      ]);
      setConvs(dm);
      setEventChats(evts);
    } catch (e: any) {
      setError(e?.message ?? "Erreur de chargement.");
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const eventUnread = eventChats.reduce((n, c) => n + (c.unreadCount || 0), 0);

  // Appui long sur une conversation → suppression. La confirmation insiste sur
  // le fait que c'est définitif et que ça vaut pour les deux participants :
  // le serveur supprime la conversation et tous ses messages.
  const confirmDelete = useCallback(
    (conversationId: string, otherName: string) => {
      Alert.alert(
        "Retirer de ma liste",
        `Les messages échangés avec ${otherName} disparaîtront de votre côté. ${otherName} garde sa copie, et la conversation réapparaîtra si un nouveau message arrive.`,
        [
          { text: "Annuler", style: "cancel" },
          {
            text: "Retirer",
            style: "destructive",
            onPress: async () => {
              setDeletingId(conversationId);
              setError(null);
              try {
                await deleteConversation(conversationId);
                setConvs((prev) =>
                  (prev ?? []).filter((c) => c._id !== conversationId),
                );
              } catch (e: any) {
                setError(e?.message ?? "Suppression impossible.");
              } finally {
                setDeletingId(null);
              }
            },
          },
        ],
      );
    },
    [],
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
        text="Tes messages sont chiffrés de bout en bout : personne d'autre que toi et ton ami ne peut les lire. Appui long sur une conversation pour la retirer de ta liste. Ajoute des amis depuis Profil → Mes amis."
      />
      {error && <Text style={styles.error}>{error}</Text>}

      {/* L'onglet n'apparaît que s'il y a quelque chose derrière : sur un
          compte sans événement, il n'ajouterait qu'une décision à prendre. */}
      {eventChats.length > 0 && (
        <View style={styles.tabs}>
          <Pressable
            style={[styles.tab, tab === "dm" && styles.tabActive]}
            onPress={() => setTab("dm")}
          >
            <Text
              style={[styles.tabText, tab === "dm" && styles.tabTextActive]}
            >
              Amis
            </Text>
          </Pressable>
          <Pressable
            style={[styles.tab, tab === "events" && styles.tabActive]}
            onPress={() => setTab("events")}
          >
            <Text
              style={[styles.tabText, tab === "events" && styles.tabTextActive]}
            >
              Événements
            </Text>
            {eventUnread > 0 && (
              <View style={styles.tabBadge}>
                <Text style={styles.tabBadgeText}>{eventUnread}</Text>
              </View>
            )}
          </Pressable>
        </View>
      )}

      {tab === "events" ? (
        <FlatList
          data={eventChats}
          keyExtractor={(c) => c._id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ListEmptyComponent={
            <Text style={styles.empty}>
              Aucune discussion d'événement pour l'instant.
            </Text>
          }
          renderItem={({ item }) => {
            const preview = item.lastMessage.isEncrypted
              ? "🔒 Message"
              : item.lastMessage.content;
            const who = item.lastMessage.sender?.name;
            return (
              <Pressable
                style={({ pressed }) => [styles.row, pressed && { opacity: 0.8 }]}
                onPress={() => router.push(`/event/chat/${item.shortId}`)}
              >
                <View style={styles.eventIcon}>
                  <Text style={styles.eventIconText}>🎉</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.topLine}>
                    <Text style={styles.name} numberOfLines={1}>
                      {item.title}
                    </Text>
                    <Text style={styles.time}>
                      {timeAgo(item.lastMessageAt)}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.preview,
                      item.unreadCount > 0 && styles.previewUnread,
                    ]}
                    numberOfLines={1}
                  >
                    {who ? `${who} : ${preview}` : preview}
                  </Text>
                </View>
                {item.unreadCount > 0 && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{item.unreadCount}</Text>
                  </View>
                )}
              </Pressable>
            );
          }}
        />
      ) : (
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
              style={({ pressed }) => [
                styles.row,
                pressed && { opacity: 0.8 },
                deletingId === item._id && { opacity: 0.5 },
              ]}
              onPress={() =>
                router.push(
                  `/chat/${other._id}?name=${encodeURIComponent(other.name)}&avatar=${encodeURIComponent(other.avatar ?? "")}`,
                )
              }
              onLongPress={() =>
                confirmDelete(
                  item._id,
                  `${other.name}${other.surname ? ` ${other.surname}` : ""}`,
                )
              }
              delayLongPress={400}
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
    tabs: {
      flexDirection: "row",
      gap: 8,
      paddingHorizontal: 12,
      paddingTop: 8,
    },
    tab: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingVertical: 8,
      paddingHorizontal: 14,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: c.border,
    },
    tabActive: { backgroundColor: c.primarySoft, borderColor: c.primary },
    tabText: { fontSize: 13, fontWeight: "700", color: c.sub },
    tabTextActive: { color: c.primaryStrong },
    tabBadge: {
      minWidth: 18,
      paddingHorizontal: 5,
      height: 18,
      borderRadius: 9,
      backgroundColor: c.danger,
      alignItems: "center",
      justifyContent: "center",
    },
    tabBadgeText: { color: c.white, fontSize: 11, fontWeight: "800" },
    // Pas d'avatar pour une discussion de groupe : une pastille d'événement
    // occupe la même place, pour que les deux listes s'alignent.
    eventIcon: {
      width: 46,
      height: 46,
      borderRadius: 23,
      backgroundColor: c.primarySoft,
      alignItems: "center",
      justifyContent: "center",
    },
    eventIconText: { fontSize: 22 },
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
