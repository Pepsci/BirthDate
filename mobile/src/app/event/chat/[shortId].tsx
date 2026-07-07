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
import { Stack, useLocalSearchParams } from "expo-router";
import { useHeaderHeight } from "@react-navigation/elements";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useKeyboardPadding } from "../../../lib/use-keyboard-padding";
import type { Socket } from "socket.io-client";
import { useAuth } from "../../../lib/auth-context";
import { getSocket } from "../../../lib/socket";
import {
  EventChatMessage,
  fetchMessages,
  fetchEvent,
} from "../../../lib/events";
import {
  getPrivateKey,
  encryptMessage,
  decryptMessage,
} from "../../../lib/crypto";

export default function EventChatScreen() {
  const { shortId } = useLocalSearchParams<{ shortId: string }>();
  const { user } = useAuth();
  const headerHeight = useHeaderHeight();
  const keyboardPadding = useKeyboardPadding();
  const insets = useSafeAreaInsets();
  // Clavier ouvert → hauteur clavier ; fermé → barre système (edge-to-edge)
  const bottomPad = keyboardPadding > 0 ? keyboardPadding : insets.bottom;
  const [messages, setMessages] = useState<EventChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [typingName, setTypingName] = useState<string | null>(null);
  const [e2eReady, setE2eReady] = useState<boolean | null>(null);

  // Refs pour éviter les stale closures dans les handlers socket
  // (même règle que chatHandlers.js côté serveur / web)
  const socketRef = useRef<Socket | null>(null);
  const privateKeyRef = useRef<Uint8Array | null>(null);
  // publicKey de chaque participant (userId → clé), miroir de participantKeysRef web
  const participantKeysRef = useRef<Record<string, string>>({});
  const myPublicKeyRef = useRef<string | null>(null);
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!shortId) return;
    let mounted = true;

    (async () => {
      try {
        const [history, ev, privKey] = await Promise.all([
          fetchMessages(shortId),
          fetchEvent(shortId),
          getPrivateKey(),
        ]);
        privateKeyRef.current = privKey;
        setE2eReady(!!privKey);
        console.log(
          `🔐 Chat: clé privée ${privKey ? "présente ✅" : "ABSENTE ❌"}`,
        );

        // Clés publiques des participants (invités + organisateur), sauf moi
        const keys: Record<string, string> = {};
        for (const inv of ev.invitations ?? []) {
          if (inv.user?.publicKey && inv.user._id !== user?._id) {
            keys[inv.user._id] = inv.user.publicKey;
          }
        }
        if (ev.organizer?.publicKey && ev.organizer._id !== user?._id) {
          keys[ev.organizer._id] = ev.organizer.publicKey;
        }
        participantKeysRef.current = keys;
        myPublicKeyRef.current =
          (ev.invitations ?? []).find((i) => i.user?._id === user?._id)?.user
            ?.publicKey ??
          (ev.organizer._id === user?._id ? ev.organizer.publicKey : null) ??
          null;

        if (mounted) setMessages(history);
      } catch (e: any) {
        if (mounted) setError(e?.message ?? "Erreur de chargement.");
      } finally {
        if (mounted) setLoading(false);
      }

      const socket = await getSocket();
      if (!mounted) return;
      socketRef.current = socket;

      const onNew = ({
        shortId: sid,
        message,
      }: {
        shortId: string;
        message: EventChatMessage & { tempId?: string };
      }) => {
        console.log(`💬 message_new reçu (event ${sid})`);
        if (sid !== shortId) return;
        setMessages((prev) => {
          // Dédoublonnage : écho de notre propre envoi (tempId) ou _id déjà présent
          if (prev.some((m) => m._id === message._id)) return prev;
          return [...prev, message];
        });
      };

      const onTypingStart = ({ userName }: { userName?: string }) => {
        setTypingName(userName ?? "Quelqu'un");
        if (typingTimeout.current) clearTimeout(typingTimeout.current);
        typingTimeout.current = setTimeout(() => setTypingName(null), 3000);
      };
      const onTypingStop = () => setTypingName(null);

      // Ré-enregistrement à chaque (re)connexion — pattern anti-stale-closure
      const register = () => {
        console.log(`💬 event:join émis pour ${shortId}`);
        socket.emit("event:join", { shortId });
      };

      const onConnectError = (err: Error) => {
        setError(`Connexion temps réel impossible : ${err.message}`);
      };
      const onMessageError = ({ error }: { error?: string }) => {
        setError(error ?? "Erreur d'envoi du message.");
      };

      socket.on("connect_error", onConnectError);
      socket.on("event:message_error", onMessageError);
      socket.on("event:message_new", onNew);
      socket.on("event:typing_start", onTypingStart);
      socket.on("event:typing_stop", onTypingStop);
      socket.on("connect", register);
      if (socket.connected) register();

      // Cleanup capturé
      cleanupRef.current = () => {
        socket.emit("event:leave", { shortId });
        socket.off("connect_error", onConnectError);
        socket.off("event:message_error", onMessageError);
        socket.off("event:message_new", onNew);
        socket.off("event:typing_start", onTypingStart);
        socket.off("event:typing_stop", onTypingStop);
        socket.off("connect", register);
      };
    })();

    return () => {
      mounted = false;
      cleanupRef.current?.();
    };
  }, [shortId]);

  const send = useCallback(() => {
    const content = input.trim();
    if (!content || !socketRef.current || !shortId) return;
    setError(null);

    const myPrivateKey = privateKeyRef.current;
    const myPublicKey = myPublicKeyRef.current;
    const keys = participantKeysRef.current;
    const shouldEncrypt =
      !!myPrivateKey && !!myPublicKey && Object.keys(keys).length > 0;

    if (shouldEncrypt) {
      const encryptedFor: Record<string, string> = {};
      for (const [userId, pubKey] of Object.entries(keys)) {
        encryptedFor[userId] = encryptMessage(content, pubKey, myPrivateKey!);
      }
      if (user?._id && !encryptedFor[user._id]) {
        encryptedFor[user._id] = encryptMessage(
          content,
          myPublicKey!,
          myPrivateKey!,
        );
      }
      socketRef.current.emit("event:message_send", {
        shortId,
        content: user?._id ? encryptedFor[user._id] : content,
        isEncrypted: true,
        encryptedFor,
      });
    } else {
      socketRef.current.emit("event:message_send", { shortId, content });
    }
    setInput("");
  }, [input, shortId, user?._id]);

  const onChangeInput = (text: string) => {
    setInput(text);
    if (shortId && socketRef.current?.connected) {
      socketRef.current.emit("event:typing_start", { shortId });
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title: "Chat" }} />
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
      <Stack.Screen options={{ title: "Chat de l'événement" }} />

      {error && <Text style={styles.error}>{error}</Text>}
      {e2eReady === false && (
        <Text style={styles.e2eWarn}>
          ⚠️ Clé privée absente sur cet appareil — déconnecte-toi puis
          reconnecte-toi pour activer le chiffrement.
        </Text>
      )}

      <FlatList
        data={[...messages].reverse()}
        inverted
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <MessageBubble
            message={item}
            isMine={item.sender?._id === user?._id}
            myUserId={user?._id ?? null}
            privateKey={privateKeyRef.current}
          />
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>Aucun message. Lance la discussion !</Text>
        }
      />

      {typingName && (
        <Text style={styles.typing}>{typingName} est en train d'écrire…</Text>
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

function MessageBubble({
  message,
  isMine,
  myUserId,
  privateKey,
}: {
  message: EventChatMessage;
  isMine: boolean;
  myUserId: string | null;
  privateKey: Uint8Array | null;
}) {
  const time = new Date(message.createdAt).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <View style={[styles.bubbleRow, isMine && styles.bubbleRowMine]}>
      <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleOther]}>
        {!isMine && (
          <Text style={styles.senderName}>
            {message.sender?.name ?? "Invité"}
          </Text>
        )}
        <Text style={[styles.msgText, isMine && styles.msgTextMine]}>
          {displayContent(message, myUserId, privateKey)}
        </Text>
        <Text style={[styles.time, isMine && styles.timeMine]}>{time}</Text>
      </View>
    </View>
  );
}

function displayContent(
  message: EventChatMessage,
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
    "🔒 Message chiffré (déchiffrement impossible)"
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
  e2eWarn: {
    color: "#92400e",
    backgroundColor: "#fef3c7",
    textAlign: "center",
    padding: 6,
    fontSize: 12,
  },
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
  senderName: { fontSize: 11, fontWeight: "700", color: "#3b82f6", marginBottom: 2 },
  msgText: { color: "#111827", fontSize: 15, lineHeight: 20 },
  msgTextMine: { color: "#fff" },
  time: { fontSize: 10, color: "#9ca3af", alignSelf: "flex-end", marginTop: 2 },
  timeMine: { color: "#dbeafe" },
  typing: { color: "#9ca3af", fontSize: 12, paddingHorizontal: 14, paddingBottom: 2 },
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
