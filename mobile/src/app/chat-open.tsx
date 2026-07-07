import { useEffect } from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { fetchConversations } from "../lib/conversations";
import { useAuth } from "../lib/auth-context";

/**
 * Écran relais ouvert depuis une notification de message (centre de notif ou push).
 * Le lien backend ne porte qu'un conversationId (ou un friendId) ; la route de chat
 * a besoin du friendId (l'autre participant). On résout ici puis on redirige.
 */
export default function ChatOpen() {
  const { conversationId, friendId } = useLocalSearchParams<{
    conversationId?: string;
    friendId?: string;
  }>();
  const router = useRouter();
  const { user } = useAuth();

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const convs = await fetchConversations();

        let targetId: string | null = friendId ?? null;
        let name: string | undefined;

        if (conversationId) {
          const conv = convs.find((c) => c._id === conversationId);
          const other = conv?.participants.find((p) => p._id !== user?._id);
          if (other) {
            targetId = other._id;
            name = other.name;
          }
        } else if (friendId) {
          for (const c of convs) {
            const other = c.participants.find((p) => p._id === friendId);
            if (other) {
              name = other.name;
              break;
            }
          }
        }

        if (!active) return;

        if (targetId) {
          const suffix = name ? `?name=${encodeURIComponent(name)}` : "";
          router.replace(`/chat/${targetId}${suffix}` as never);
        } else {
          // Conversation introuvable → on retombe sur la liste des chats
          router.replace("/chats" as never);
        }
      } catch {
        if (active) router.replace("/chats" as never);
      }
    })();

    return () => {
      active = false;
    };
  }, [conversationId, friendId, user?._id, router]);

  return (
    <View style={styles.center}>
      <Stack.Screen options={{ title: "Ouverture…" }} />
      <ActivityIndicator size="large" color="#3b82f6" />
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f9fafb",
  },
});
