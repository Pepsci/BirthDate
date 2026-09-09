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
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import HeaderIconButton from "../../../components/HeaderIconButton";
import MuteSheet from "../../../components/MuteSheet";
import { useMute } from "../../../lib/mutes";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  useKeyboardPadding,
  useKeyboardVisible,
} from "../../../lib/use-keyboard-padding";
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
import { promptReport } from "../../../lib/moderation";
import Avatar from "../../../components/Avatar";
import {
  useTheme,
  useThemedStyles,
  ThemeColors,
} from "../../../lib/theme-context";

/** Posé sur la bulle bleue, qui ne change pas avec le thème. */
const ON_PRIMARY = "#ffffff";
const ON_PRIMARY_SOFT = "#dbeafe";

export default function EventChatScreen() {
  const { shortId } = useLocalSearchParams<{ shortId: string }>();
  const router = useRouter();
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  const { user } = useAuth();
  const keyboardPadding = useKeyboardPadding();
  const keyboardVisible = useKeyboardVisible();
  const insets = useSafeAreaInsets();
  // Conteneur : ne gère que le décalage clavier (Android ; iOS via KAV).
  const bottomPad = keyboardPadding;
  // Barre d'input : marge de sécurité au-dessus du home indicator quand le
  // clavier est fermé (réduite quand il est ouvert, car il couvre déjà la zone).
  const inputBottom = keyboardVisible ? 10 : insets.bottom + 12;
  const [messages, setMessages] = useState<EventChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [typingName, setTypingName] = useState<string | null>(null);
  const [e2eReady, setE2eReady] = useState<boolean | null>(null);
  /**
   * Titre de l'événement.
   *
   * ⚠️ L'écran s'intitulait « Chat de l'événement » — lisible quand on y
   * arrive depuis l'événement lui-même, illisible depuis la liste des
   * discussions : on ouvre une conversation sans savoir laquelle. L'événement
   * est déjà chargé ici pour les clés de chiffrement, on en garde le titre.
   */
  const [eventTitle, setEventTitle] = useState<string | null>(null);
  const [muteSheet, setMuteSheet] = useState(false);
  const mute = useMute("event", shortId ?? null);

  // Refs pour éviter les stale closures dans les handlers socket
  // (même règle que chatHandlers.js côté serveur / web)
  const socketRef = useRef<Socket | null>(null);
  // Ref (callbacks socket) + state (re-render quand la clé arrive tard,
  // ex. ouverture via une notification / retour de veille)
  const privateKeyRef = useRef<Uint8Array | null>(null);
  const [privateKey, setPrivateKeyState] = useState<Uint8Array | null>(null);
  const setPrivateKey = (k: Uint8Array | null) => {
    privateKeyRef.current = k;
    setPrivateKeyState(k);
    setE2eReady(!!k);
  };
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
        setEventTitle(ev.title ?? null);
        setPrivateKey(privKey);
        console.log(
          `🔐 Chat: clé privée ${privKey ? "présente ✅" : "ABSENTE ❌"}`,
        );

        // Clé brièvement indisponible (réveil, migration Keychain) → retry
        if (!privKey) {
          let attempts = 0;
          const retry = async () => {
            if (!mounted || privateKeyRef.current) return;
            const k = await getPrivateKey();
            if (!mounted) return;
            if (k) setPrivateKey(k);
            else if (++attempts < 3) setTimeout(retry, 800);
          };
          setTimeout(retry, 800);
        }

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
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  // Ordre d'affichage : plus récent en premier (liste inversée)
  const ordered = [...messages].reverse();

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingBottom: bottomPad }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      // ⚠️ Décalage à 0, et pas la hauteur de l'en-tête.
      //
      // KeyboardAvoidingView en mode "padding" calcule sa marge basse ainsi :
      //   marge = bas_de_la_vue − haut_du_clavier + keyboardVerticalOffset
      // Comme cette vue descend jusqu'au bas de l'écran, le premier terme vaut
      // déjà exactement la hauteur du clavier : tout décalage ajouté se
      // retrouve en trou entre le champ de saisie et le clavier.
      //
      // La valeur précédente venait de l'en-tête natif. Depuis que la pile
      // rend son en-tête en JS (AppStackHeader), celui-ci est au-dessus de
      // cette vue dans l'arbre : sa hauteur est déjà exclue de la mesure, et
      // la réintroduire ici la comptait deux fois.
      keyboardVerticalOffset={0}
    >
      <Stack.Screen
        options={{
          title: eventTitle ?? "Chat de l'événement",
          headerRight: () => (
            <HeaderIconButton
              name={mute.mute ? "bell-off" : "bell"}
              accessibilityLabel={
                mute.mute
                  ? "Réactiver les notifications"
                  : "Couper les notifications"
              }
              onPress={() => setMuteSheet(true)}
            />
          ),
        }}
      />

      <MuteSheet
        visible={muteSheet}
        mute={mute.mute}
        onClose={() => setMuteSheet(false)}
        onSelect={(d) => mute.set(d)}
        onClear={() => mute.clear()}
      />

      {/* Retour à l'événement. Depuis la liste des discussions, cet écran est
          une impasse : on lit un message qui parle de la date ou d'un cadeau,
          et rien ne mène à l'endroit où en décider. Le bouton « retour » de
          l'en-tête ramène à la liste, pas à l'événement. */}
      <Pressable
        style={styles.eventLink}
        onPress={() => router.push(`/event/${shortId}`)}
      >
        <Text style={styles.eventLinkText} numberOfLines={1}>
          🎉 {eventTitle ?? "Voir l'événement"}
        </Text>
        <Text style={styles.eventLinkGo}>Ouvrir ›</Text>
      </Pressable>

      {error && <Text style={styles.error}>{error}</Text>}
      {e2eReady === false && (
        <Text style={styles.e2eWarn}>
          ⚠️ Clé privée absente sur cet appareil — déconnecte-toi puis
          reconnecte-toi pour activer le chiffrement.
        </Text>
      )}

      <FlatList
        data={ordered}
        inverted
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.list}
        renderItem={({ item, index }) => {
          const newer = ordered[index - 1]; // affiché en dessous (plus récent)
          const older = ordered[index + 1]; // affiché au-dessus (plus ancien)
          const isLastOfRun =
            !newer || newer.sender?._id !== item.sender?._id;
          const isFirstOfRun =
            !older || older.sender?._id !== item.sender?._id;
          return (
          <MessageBubble
            message={item}
            isMine={item.sender?._id === user?._id}
            showAvatar={isLastOfRun}
            showName={isFirstOfRun}
            myUserId={user?._id ?? null}
            privateKey={privateKey}
            onReport={
              item.sender?._id !== user?._id
                ? () =>
                    promptReport({
                      contentType: "eventMessage",
                      contentId: item._id,
                      targetUserId: item.sender?._id,
                      contentPreview: displayContent(
                        item,
                        user?._id ?? null,
                        privateKeyRef.current,
                      ),
                    })
                : undefined
            }
          />
          );
        }}
        ListEmptyComponent={
          <Text style={styles.empty}>Aucun message. Lance la discussion !</Text>
        }
      />

      {typingName && (
        <Text style={styles.typing}>{typingName} est en train d'écrire…</Text>
      )}

      <View style={[styles.inputRow, { paddingBottom: inputBottom }]}>
        <TextInput placeholderTextColor={colors.placeholder}
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
  showAvatar = true,
  showName = true,
  myUserId,
  privateKey,
  onReport,
}: {
  message: EventChatMessage;
  isMine: boolean;
  showAvatar?: boolean;
  showName?: boolean;
  myUserId: string | null;
  privateKey: Uint8Array | null;
  onReport?: () => void;
}) {
  const styles = useThemedStyles(makeStyles);
  const time = new Date(message.createdAt).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <View style={[styles.bubbleRow, isMine && styles.bubbleRowMine]}>
      {!isMine &&
        (showAvatar ? (
          <Avatar
            uri={message.sender?.avatar}
            name={message.sender?.name}
            surname={message.sender?.surname}
            size={28}
          />
        ) : (
          <View style={styles.avatarSpacer} />
        ))}
      <Pressable
        onLongPress={onReport}
        delayLongPress={400}
        style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleOther]}
      >
        {!isMine && showName && (
          <Text style={styles.senderName}>
            {message.sender?.name ?? "Invité"}
          </Text>
        )}
        <Text style={[styles.msgText, isMine && styles.msgTextMine]}>
          {displayContent(message, myUserId, privateKey)}
        </Text>
        <Text style={[styles.time, isMine && styles.timeMine]}>{time}</Text>
      </Pressable>
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

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    center: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: c.bg,
    },
    // Bandeau discret : il informe et donne une sortie, il ne doit pas
    // concurrencer la conversation elle-même.
    eventLink: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
      paddingVertical: 10,
      paddingHorizontal: 14,
      backgroundColor: c.bgSecondary,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border,
    },
    eventLinkText: {
      flex: 1,
      color: c.text,
      fontWeight: "700",
      fontSize: 14,
    },
    eventLinkGo: { color: c.primary, fontWeight: "700", fontSize: 13 },
    error: { color: c.danger, textAlign: "center", padding: 6 },
    e2eWarn: {
      color: c.warningStrong,
      backgroundColor: c.warningSoft,
      textAlign: "center",
      padding: 6,
      fontSize: 12,
    },
    list: { padding: 12, gap: 6 },
    empty: {
      textAlign: "center",
      color: c.sub,
      transform: [{ scaleY: -1 }],
      marginTop: 40,
    },
    bubbleRow: { flexDirection: "row", alignItems: "flex-end", gap: 6 },
    bubbleRowMine: { justifyContent: "flex-end" },
    avatarSpacer: { width: 28 },
    bubble: {
      maxWidth: "80%",
      borderRadius: 14,
      paddingVertical: 8,
      paddingHorizontal: 12,
    },
    bubbleMine: { backgroundColor: c.primary, borderBottomRightRadius: 4 },
    bubbleOther: {
      backgroundColor: c.card,
      borderBottomLeftRadius: 4,
      shadowColor: c.shadow,
      shadowOpacity: 0.05,
      shadowRadius: 3,
      shadowOffset: { width: 0, height: 1 },
      elevation: 1,
    },
    senderName: {
      fontSize: 11,
      fontWeight: "700",
      color: c.primary,
      marginBottom: 2,
    },
    msgText: { color: c.text, fontSize: 15, lineHeight: 20 },
    msgTextMine: { color: ON_PRIMARY },
    time: {
      fontSize: 10,
      color: c.faint,
      alignSelf: "flex-end",
      marginTop: 2,
    },
    timeMine: { color: ON_PRIMARY_SOFT },
    typing: {
      color: c.faint,
      fontSize: 12,
      paddingHorizontal: 14,
      paddingBottom: 2,
    },
    inputRow: {
      flexDirection: "row",
      alignItems: "flex-end",
      gap: 8,
      padding: 10,
      backgroundColor: c.card,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.border,
    },
    input: {
      flex: 1,
      borderWidth: 1,
      borderColor: c.inputBorder,
      borderRadius: 18,
      paddingHorizontal: 14,
      paddingVertical: 8,
      fontSize: 15,
      maxHeight: 100,
      backgroundColor: c.inputBg,
      color: c.text,
    },
    sendBtn: {
      backgroundColor: c.primary,
      borderRadius: 18,
      width: 38,
      height: 38,
      justifyContent: "center",
      alignItems: "center",
    },
    sendText: { color: ON_PRIMARY, fontSize: 16 },
  });
