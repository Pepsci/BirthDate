import { t } from "@/i18n";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { Stack, useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import {
  SupportTicket,
  SupportStatus,
  fetchTicket,
  replyToTicket,
} from "../../lib/support";
import { getSocket } from "../../lib/socket";
import { timeAgo } from "../../lib/notifications";
import {
  useTheme,
  useThemedStyles,
  ThemeColors,
} from "../../lib/theme-context";
import { readingPane } from "../../lib/layout";

const REPLY_MAX = 2000;

const STATUS_LABEL: Record<SupportStatus, string> = {
  get open() { return t("support:status.open"); },
  get answered() { return t("chat:list.answered"); },
  get closed() { return t("chat:list.closed"); },
};

const CATEGORY_EMOJI = { general: "✉️", pool: "💶", nameday: "🌸" } as const;

/**
 * Une conversation avec le support — équivalent mobile de l'onglet Support
 * du web (front/…/chat/SupportThread.jsx).
 *
 * Ouvrir l'écran marque la réponse comme lue (GET /support/mine/:id).
 * Mise à jour en direct : le serveur pousse le ticket sur le socket
 * (« support:message ») quand l'équipe répond.
 *
 * Un ticket fermé ne se rouvre pas : la saisie est remplacée par un bouton
 * « Nouveau sujet » (règle serveur, voir routes/support.js).
 */
export default function SupportTicketScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  const scrollRef = useRef<ScrollView>(null);

  const [ticket, setTicket] = useState<SupportTicket | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(null);
      setTicket(await fetchTicket(String(id)));
    } catch (e: any) {
      setError(e?.message ?? t("support:ticket.notFound"));
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  // Réponse de l'équipe en direct
  useEffect(() => {
    let socket: Awaited<ReturnType<typeof getSocket>> | null = null;
    let alive = true;
    const onSupport = (payload: { ticket?: SupportTicket }) => {
      if (payload?.ticket?._id === id) load(); // recharge = marque comme lu
    };
    getSocket()
      .then((s) => {
        if (!alive) return;
        socket = s;
        s.on("support:message", onSupport);
      })
      .catch(() => {});
    return () => {
      alive = false;
      socket?.off("support:message", onSupport);
    };
  }, [id, load]);

  const send = async () => {
    const text = reply.trim();
    if (!text || sending || !ticket) return;
    setSending(true);
    setError(null);
    try {
      setTicket(await replyToTicket(ticket._id, text));
      setReply("");
    } catch (e: any) {
      setError(e?.message ?? t("support:ticket.sendError"));
      load(); // le ticket a peut-être été fermé entre-temps
    } finally {
      setSending(false);
    }
  };

  if (!ticket) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title: t("support:title") }} />
        {error ? (
          <Text style={styles.error}>{error}</Text>
        ) : (
          <ActivityIndicator size="large" color={colors.primary} />
        )}
      </View>
    );
  }

  const closed = ticket.status === "closed";

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
    >
      <Stack.Screen options={{ title: t("support:title") }} />

      <View style={styles.header}>
        <Text style={styles.subject} numberOfLines={2}>
          {CATEGORY_EMOJI[ticket.category] ?? "✉️"} {ticket.subject}
        </Text>
        <View style={[styles.status, styles[`status_${ticket.status}`]]}>
          <Text style={styles.statusText}>{STATUS_LABEL[ticket.status]}</Text>
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.thread}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
      >
        {ticket.messages.map((m) => {
          const mine = m.sender === "user";
          return (
            <View
              key={m._id}
              style={[styles.bubbleRow, mine ? styles.rowMine : styles.rowTheirs]}
            >
              <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
                {!mine && <Text style={styles.author}>{t("support:ticket.team")}</Text>}
                <Text style={mine ? styles.textMine : styles.textTheirs}>{m.body}</Text>
                <Text style={[styles.time, mine && styles.timeMine]}>
                  {timeAgo(m.createdAt)}
                </Text>
              </View>
            </View>
          );
        })}
        {ticket.status === "open" && (
          <Text style={styles.waiting}>
            {t("support:ticket.hint")}
          </Text>
        )}
      </ScrollView>

      {error && <Text style={[styles.error, styles.errorBar]}>{error}</Text>}

      {closed ? (
        <View style={styles.closedBar}>
          <Text style={styles.closedText}>
            {t("support:ticket.closed")}
          </Text>
          <Pressable style={styles.newBtn} onPress={() => router.push("/contact")}>
            <Text style={styles.newBtnText}>{t("support:ticket.newTopic")}</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.inputBar}>
          <TextInput
            style={styles.input}
            value={reply}
            onChangeText={(t) => setReply(t.slice(0, REPLY_MAX))}
            placeholder={t("support:ticket.placeholder")}
            placeholderTextColor={colors.placeholder}
            multiline
          />
          <Pressable
            style={[styles.sendBtn, (!reply.trim() || sending) && styles.disabled]}
            onPress={send}
            disabled={!reply.trim() || sending}
          >
            <Text style={styles.sendText}>{sending ? "…" : t("chat:reply.send")}</Text>
          </Pressable>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    center: {
      flex: 1,
      backgroundColor: c.bg,
      justifyContent: "center",
      alignItems: "center",
      padding: 24,
    },
    header: {
      padding: 14,
      gap: 8,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border,
      backgroundColor: c.card,
      ...readingPane,
    },
    subject: { fontSize: 15, fontWeight: "800", color: c.text },
    status: {
      alignSelf: "flex-start",
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 3,
    },
    status_open: { backgroundColor: c.warningSoft },
    status_answered: { backgroundColor: c.successSoft },
    status_closed: { backgroundColor: c.cardSoft },
    statusText: { fontSize: 11.5, fontWeight: "700", color: c.text },
    thread: { padding: 14, gap: 10, ...readingPane },
    bubbleRow: { flexDirection: "row" },
    rowMine: { justifyContent: "flex-end" },
    rowTheirs: { justifyContent: "flex-start" },
    bubble: { maxWidth: "85%", borderRadius: 14, padding: 10, gap: 4 },
    bubbleMine: { backgroundColor: c.primary, borderBottomRightRadius: 4 },
    bubbleTheirs: {
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.border,
      borderBottomLeftRadius: 4,
    },
    author: { fontSize: 11.5, fontWeight: "700", color: c.primaryStrong },
    textMine: { color: c.white, fontSize: 14, lineHeight: 20 },
    textTheirs: { color: c.text, fontSize: 14, lineHeight: 20 },
    time: { fontSize: 10.5, color: c.faint, alignSelf: "flex-end" },
    timeMine: { color: c.white, opacity: 0.8 },
    waiting: { textAlign: "center", color: c.faint, fontSize: 12, marginTop: 6 },
    error: { color: c.danger, fontSize: 13 },
    errorBar: { paddingHorizontal: 14, paddingBottom: 6 },
    inputBar: {
      flexDirection: "row",
      alignItems: "flex-end",
      gap: 8,
      padding: 10,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.border,
      backgroundColor: c.card,
    },
    input: {
      flex: 1,
      maxHeight: 120,
      borderWidth: 1,
      borderColor: c.inputBorder,
      borderRadius: 18,
      paddingHorizontal: 14,
      paddingVertical: 9,
      fontSize: 14,
      backgroundColor: c.inputBg,
      color: c.text,
    },
    sendBtn: {
      backgroundColor: c.primary,
      borderRadius: 18,
      paddingHorizontal: 16,
      paddingVertical: 10,
    },
    sendText: { color: c.white, fontWeight: "700", fontSize: 14 },
    disabled: { opacity: 0.5 },
    closedBar: {
      padding: 14,
      gap: 10,
      alignItems: "center",
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.border,
      backgroundColor: c.card,
    },
    closedText: { color: c.sub, fontSize: 13, textAlign: "center" },
    newBtn: {
      backgroundColor: c.primary,
      borderRadius: 10,
      paddingVertical: 10,
      paddingHorizontal: 20,
    },
    newBtnText: { color: c.white, fontWeight: "700" },
  });
