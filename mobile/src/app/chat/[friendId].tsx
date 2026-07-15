import { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { Alert } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { promptReport, promptBlock } from "../../lib/moderation";
import { useHeaderHeight } from "@react-navigation/elements";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useKeyboardPadding } from "../../lib/use-keyboard-padding";
import type { Socket } from "socket.io-client";
import GiftShareCard from "../../components/GiftShareCard";
import { useAuth } from "../../lib/auth-context";
import { useUnread } from "../../lib/unread-context";
import { getSocket } from "../../lib/socket";
import {
  DMMessage,
  startConversation,
  fetchDMMessages,
  markConversationRead,
  fetchUserPublicKey,
} from "../../lib/conversations";
import {
  getPrivateKey,
  encryptMessage,
  decryptMessage,
} from "../../lib/crypto";

export default function DMChatScreen() {
  const { friendId, name } = useLocalSearchParams<{
    friendId: string;
    name?: string;
  }>();
  const { user } = useAuth();
  const router = useRouter();
  const headerHeight = useHeaderHeight();
  const keyboardPadding = useKeyboardPadding();
  const insets = useSafeAreaInsets();
  // Clavier ouvert → hauteur clavier ; fermé → safe-area + petite marge de confort
  const bottomPad =
    keyboardPadding > 0
      ? keyboardPadding
      : insets.bottom + (Platform.OS === "ios" ? 10 : 6);
  const { refresh: refreshUnread } = useUnread();
  const [messages, setMessages] = useState<DMMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [replyTarget, setReplyTarget] = useState<DMMessage | null>(null);
  const [editTarget, setEditTarget] = useState<DMMessage | null>(null);

  const socketRef = useRef<Socket | null>(null);
  const conversationIdRef = useRef<string | null>(null);
  const privateKeyRef = useRef<Uint8Array | null>(null);
  const friendPublicKeyRef = useRef<string | null>(null);
  const myPublicKeyRef = useRef<string | null>(null);
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!friendId) return;
    let mounted = true;

    (async () => {
      try {
        // 1. Trouver/créer la conversation, puis charger le reste en parallèle
        const conv = await startConversation(friendId);
        conversationIdRef.current = conv._id;

        const [history, privKey, friendKey, myKey] = await Promise.all([
          fetchDMMessages(conv._id),
          getPrivateKey(),
          fetchUserPublicKey(friendId),
          user?._id ? fetchUserPublicKey(user._id) : Promise.resolve(null),
        ]);
        privateKeyRef.current = privKey;
        friendPublicKeyRef.current = friendKey;
        myPublicKeyRef.current = myKey;

        if (mounted) setMessages(history);
        markConversationRead(conv._id).then(refreshUnread).catch(() => {});
      } catch (e: any) {
        if (mounted) setError(e?.message ?? "Erreur de chargement.");
        return;
      } finally {
        if (mounted) setLoading(false);
      }

      const socket = await getSocket();
      if (!mounted) return;
      socketRef.current = socket;
      const convId = conversationIdRef.current!;

      const onNew = ({
        conversationId,
        message,
      }: {
        conversationId: string;
        message: DMMessage;
      }) => {
        if (conversationId !== convId) return;
        setMessages((prev) =>
          prev.some((m) => m._id === message._id) ? prev : [...prev, message],
        );
        markConversationRead(convId).then(refreshUnread).catch(() => {});
      };

      const onDeleted = ({
        messageId,
        conversationId,
      }: {
        messageId: string;
        conversationId: string;
      }) => {
        if (conversationId !== convId) return;
        setMessages((prev) => prev.filter((m) => m._id !== messageId));
      };

      const onEdited = (payload: {
        messageId: string;
        conversationId: string;
        content: string;
        encryptedFor?: Record<string, string>;
        editedAt?: string;
      }) => {
        if (payload.conversationId !== convId) return;
        setMessages((prev) =>
          prev.map((m) =>
            m._id === payload.messageId
              ? {
                  ...m,
                  content: payload.content,
                  encryptedFor: payload.encryptedFor ?? m.encryptedFor,
                  edited: true,
                  editedAt: payload.editedAt,
                }
              : m,
          ),
        );
      };

      const onTypingStart = ({ conversationId }: { conversationId: string }) => {
        if (conversationId !== convId) return;
        setTyping(true);
        if (typingTimeout.current) clearTimeout(typingTimeout.current);
        typingTimeout.current = setTimeout(() => setTyping(false), 3000);
      };
      const onTypingStop = () => setTyping(false);

      const onMessageError = ({ error }: { error?: string }) =>
        setError(error ?? "Erreur d'envoi du message.");
      const onConnectError = (err: Error) =>
        setError(`Connexion temps réel impossible : ${err.message}`);

      // Ré-enregistrement à chaque (re)connexion — pattern anti-stale-closure
      const register = () => {
        socket.emit("conversation:join", { conversationId: convId });
      };

      socket.on("message:new", onNew);
      socket.on("message:deleted", onDeleted);
      socket.on("message:edited", onEdited);
      socket.on("typing:start", onTypingStart);
      socket.on("typing:stop", onTypingStop);
      socket.on("message:error", onMessageError);
      socket.on("connect_error", onConnectError);
      socket.on("connect", register);
      if (socket.connected) register();

      cleanupRef.current = () => {
        socket.off("message:new", onNew);
        socket.off("message:deleted", onDeleted);
        socket.off("message:edited", onEdited);
        socket.off("typing:start", onTypingStart);
        socket.off("typing:stop", onTypingStop);
        socket.off("message:error", onMessageError);
        socket.off("connect_error", onConnectError);
        socket.off("connect", register);
      };
    })();

    return () => {
      mounted = false;
      cleanupRef.current?.();
    };
  }, [friendId, user?._id]);

  const send = useCallback(() => {
    const content = input.trim();
    const convId = conversationIdRef.current;
    if (!content || !socketRef.current || !convId) return;
    setError(null);

    const myPrivateKey = privateKeyRef.current;
    const friendKey = friendPublicKeyRef.current;
    const myKey = myPublicKeyRef.current;
    // Même règle que ChatWindow.jsx : chiffré seulement si tout le monde a ses clés
    const canEncrypt = !!(myPrivateKey && friendKey && myKey);

    if (editTarget) {
      // ── Modification d'un message existant ──
      if (editTarget.isEncrypted && canEncrypt) {
        const encryptedForRecipient = encryptMessage(
          content,
          friendKey!,
          myPrivateKey!,
        );
        const encryptedForSender = encryptMessage(
          content,
          myKey!,
          myPrivateKey!,
        );
        socketRef.current.emit("message:edit", {
          messageId: editTarget._id,
          conversationId: convId,
          content: encryptedForSender,
          encryptedForRecipient,
          encryptedForSender,
        });
      } else {
        socketRef.current.emit("message:edit", {
          messageId: editTarget._id,
          conversationId: convId,
          content,
        });
      }
      setEditTarget(null);
    } else if (canEncrypt) {
      const encryptedForRecipient = encryptMessage(
        content,
        friendKey!,
        myPrivateKey!,
      );
      const encryptedForSender = encryptMessage(content, myKey!, myPrivateKey!);
      socketRef.current.emit("message:send", {
        conversationId: convId,
        content: encryptedForSender,
        isEncrypted: true,
        encryptedForRecipient,
        encryptedForSender,
        replyTo: replyTarget?._id ?? undefined,
      });
    } else {
      socketRef.current.emit("message:send", {
        conversationId: convId,
        content,
        replyTo: replyTarget?._id ?? undefined,
      });
    }

    setReplyTarget(null);
    socketRef.current.emit("typing:stop", { conversationId: convId });
    setInput("");
  }, [input, editTarget, replyTarget]);

  // ── Menu contextuel d'un message (long-press) ──────────────────────────────
  const openMessageMenu = (message: DMMessage) => {
    const isMine = message.sender?._id === user?._id;
    const text = displayContent(
      message,
      user?._id ?? null,
      privateKeyRef.current,
    );
    const locked = text.startsWith("🔒");

    const options: NonNullable<Parameters<typeof Alert.alert>[2]> = [
      {
        text: "↩️ Répondre",
        onPress: () => {
          setEditTarget(null);
          setReplyTarget(message);
        },
      },
    ];

    if (isMine) {
      const EDIT_TIME_LIMIT = 5 * 60 * 1000; // même règle que le web
      const canEdit =
        !locked &&
        Date.now() - new Date(message.createdAt).getTime() < EDIT_TIME_LIMIT;
      if (canEdit) {
        options.push({
          text: "✏️ Modifier",
          onPress: () => {
            setReplyTarget(null);
            setEditTarget(message);
            setInput(text);
          },
        });
      }
      options.push({
        text: "🗑️ Supprimer",
        style: "destructive",
        onPress: () =>
          Alert.alert(
            "Supprimer ce message ?",
            "Il sera supprimé pour tout le monde.",
            [
              { text: "Annuler", style: "cancel" },
              {
                text: "Supprimer",
                style: "destructive",
                onPress: () =>
                  socketRef.current?.emit("message:delete", {
                    messageId: message._id,
                    conversationId: conversationIdRef.current,
                  }),
              },
            ],
          ),
      });
    } else {
      options.push({
        text: "🚩 Signaler",
        style: "destructive",
        onPress: () =>
          promptReport({
            contentType: "message",
            contentId: message._id,
            targetUserId: message.sender?._id,
            contentPreview: locked ? "" : text,
          }),
      });
    }

    options.push({ text: "Annuler", style: "cancel" });
    Alert.alert(
      "Message",
      locked ? undefined : text.length > 80 ? `${text.slice(0, 80)}…` : text,
      options,
    );
  };

  // Résout la citation d'une réponse depuis la liste locale (E2E safe)
  const getQuote = (m: DMMessage) => {
    if (!m.replyTo) return null;
    const ref = messages.find((x) => x._id === m.replyTo);
    if (!ref) return { author: "", text: "Message d'origine indisponible" };
    return {
      author: ref.sender?._id === user?._id ? "Toi" : (ref.sender?.name ?? ""),
      text: displayContent(ref, user?._id ?? null, privateKeyRef.current),
    };
  };

  const onChangeInput = (text: string) => {
    setInput(text);
    const convId = conversationIdRef.current;
    if (convId && socketRef.current?.connected) {
      socketRef.current.emit("typing:start", { conversationId: convId });
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title: name ?? "Chat" }} />
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingBottom: bottomPad }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? headerHeight : 0}
    >
      <Stack.Screen
        options={{
          title: name ?? "Chat",
          headerRight: () => (
            <Pressable
              hitSlop={10}
              onPress={() =>
                Alert.alert(name ?? "Options", undefined, [
                  {
                    text: "Signaler l'utilisateur",
                    onPress: () =>
                      promptReport({
                        contentType: "user",
                        targetUserId: friendId,
                      }),
                  },
                  {
                    text: "Bloquer l'utilisateur",
                    style: "destructive",
                    onPress: () =>
                      promptBlock(friendId, name ?? "cet utilisateur", () =>
                        router.back(),
                      ),
                  },
                  { text: "Annuler", style: "cancel" },
                ])
              }
            >
              <Text style={{ fontSize: 22, color: "#6b7280" }}>⋯</Text>
            </Pressable>
          ),
        }}
      />

      {error && <Text style={styles.error}>{error}</Text>}

      <FlatList
        data={[...messages].reverse()}
        inverted
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) =>
          item.type === "gift_share" ? (
            <GiftShareCard
              message={item}
              isMine={item.sender?._id === user?._id}
            />
          ) : (
            <Bubble
              message={item}
              isMine={item.sender?._id === user?._id}
              myUserId={user?._id ?? null}
              privateKey={privateKeyRef.current}
              quote={getQuote(item)}
              onLongPress={() => openMessageMenu(item)}
            />
          )
        }
        ListEmptyComponent={
          <Text style={styles.empty}>
            Aucun message. Dis bonjour à {name ?? "ton ami·e"} !
          </Text>
        }
      />

      {typing && <Text style={styles.typing}>En train d'écrire…</Text>}

      {(replyTarget || editTarget) && (
        <View style={styles.composerBanner}>
          <View style={styles.composerBannerBody}>
            <Text style={styles.bannerTitle}>
              {editTarget
                ? "✏️ Modifier le message"
                : `↩️ Répondre à ${
                    replyTarget?.sender?._id === user?._id
                      ? "toi-même"
                      : (name ?? "…")
                  }`}
            </Text>
            <Text numberOfLines={1} style={styles.bannerText}>
              {displayContent(
                (editTarget ?? replyTarget)!,
                user?._id ?? null,
                privateKeyRef.current,
              )}
            </Text>
          </View>
          <Pressable
            hitSlop={8}
            onPress={() => {
              setReplyTarget(null);
              if (editTarget) setInput("");
              setEditTarget(null);
            }}
          >
            <Text style={styles.bannerClose}>✕</Text>
          </Pressable>
        </View>
      )}

      <View style={styles.inputRow}>
        <TextInput placeholderTextColor="#9ca3af"
          style={styles.input}
          placeholder="Ton message…"
          value={input}
          onChangeText={onChangeInput}
          multiline
          maxLength={2000}
        />
        <Pressable
          onPress={send}
          disabled={!input.trim()}
          style={[styles.sendBtn, !input.trim() && { opacity: 0.4 }]}
        >
          <Text style={styles.sendText}>➤</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

function Bubble({
  message,
  isMine,
  myUserId,
  privateKey,
  quote,
  onLongPress,
}: {
  message: DMMessage;
  isMine: boolean;
  myUserId: string | null;
  privateKey: Uint8Array | null;
  quote?: { author: string; text: string } | null;
  onLongPress?: () => void;
}) {
  const time = new Date(message.createdAt).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <View style={[styles.bubbleRow, isMine && styles.bubbleRowMine]}>
      <Pressable
        onLongPress={onLongPress}
        delayLongPress={400}
        style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleOther]}
      >
        {quote && (
          <View style={[styles.quote, isMine && styles.quoteMine]}>
            {quote.author ? (
              <Text style={[styles.quoteAuthor, isMine && styles.quoteTextMine]}>
                {quote.author}
              </Text>
            ) : null}
            <Text
              numberOfLines={2}
              style={[styles.quoteText, isMine && styles.quoteTextMine]}
            >
              {quote.text}
            </Text>
          </View>
        )}
        <Text style={[styles.msgText, isMine && styles.msgTextMine]}>
          {displayContent(message, myUserId, privateKey)}
        </Text>
        <Text style={[styles.time, isMine && styles.timeMine]}>
          {time}
          {message.edited ? " · modifié" : ""}
        </Text>
      </Pressable>
    </View>
  );
}

function displayContent(
  message: DMMessage,
  myUserId: string | null,
  privateKey: Uint8Array | null,
): string {
  if (!message.isEncrypted) return message.content;
  const senderKey = message.sender?.publicKey;
  const myCopy = myUserId ? message.encryptedFor?.[myUserId] : null;
  if (!privateKey) return "🔒 Chiffré — clé privée absente (reconnecte-toi)";
  if (!senderKey) return "🔒 Chiffré — expéditeur sans clé publique";
  if (!myCopy) return "🔒 Chiffré — pas de copie pour ce compte";
  return (
    decryptMessage(myCopy, senderKey, privateKey) ??
    "🔒 Chiffré — déchiffrement impossible"
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
  list: { padding: 12, gap: 6 },
  empty: {
    textAlign: "center",
    color: "#6b7280",
    transform: [{ scaleY: -1 }],
    marginTop: 40,
  },
  bubbleRow: { flexDirection: "row" },
  bubbleRowMine: { justifyContent: "flex-end" },
  bubble: {
    maxWidth: "80%",
    borderRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  bubbleMine: { backgroundColor: "#3b82f6", borderBottomRightRadius: 4 },
  bubbleOther: {
    backgroundColor: "#fff",
    borderBottomLeftRadius: 4,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  msgText: { color: "#111827", fontSize: 15, lineHeight: 20 },
  msgTextMine: { color: "#fff" },
  time: { fontSize: 10, color: "#9ca3af", alignSelf: "flex-end", marginTop: 2 },
  timeMine: { color: "#dbeafe" },
  typing: {
    color: "#9ca3af",
    fontSize: 12,
    paddingHorizontal: 14,
    paddingBottom: 2,
  },
  quote: {
    borderLeftWidth: 3,
    borderLeftColor: "#3b82f6",
    backgroundColor: "rgba(59, 130, 246, 0.08)",
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
    marginBottom: 6,
  },
  quoteMine: {
    borderLeftColor: "#dbeafe",
    backgroundColor: "rgba(255, 255, 255, 0.15)",
  },
  quoteAuthor: { fontSize: 11, fontWeight: "700", color: "#3b82f6" },
  quoteText: { fontSize: 12, color: "#6b7280" },
  quoteTextMine: { color: "#dbeafe" },
  composerBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#eff6ff",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#e5e7eb",
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  composerBannerBody: { flex: 1 },
  bannerTitle: { fontSize: 12, fontWeight: "700", color: "#3b82f6" },
  bannerText: { fontSize: 13, color: "#6b7280", marginTop: 1 },
  bannerClose: { fontSize: 16, color: "#9ca3af", padding: 4 },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    padding: 10,
    backgroundColor: "#fff",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#e5e7eb",
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 8,
    fontSize: 15,
    maxHeight: 100,
    backgroundColor: "#f9fafb",
    color: "#111827",
  },
  sendBtn: {
    backgroundColor: "#3b82f6",
    borderRadius: 18,
    width: 38,
    height: 38,
    justifyContent: "center",
    alignItems: "center",
  },
  sendText: { color: "#fff", fontSize: 16 },
});
