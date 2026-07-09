import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Stack, useRouter } from "expo-router";
import { sendSupportMessage } from "../lib/support";

export default function SupportScreen() {
  const router = useRouter();
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const SUBJECT_MAX = 120;
  const MESSAGE_MAX = 2000;
  const canSend = subject.trim().length > 0 && message.trim().length > 0;

  const submit = async () => {
    if (!canSend || sending) return;
    setSending(true);
    setError(null);
    try {
      await sendSupportMessage(subject.trim(), message.trim());
      setSent(true);
    } catch (e: any) {
      setError(e?.message ?? "Erreur lors de l'envoi.");
    } finally {
      setSending(false);
    }
  };

  if (sent) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title: "Support" }} />
        <Text style={styles.doneEmoji}>✅</Text>
        <Text style={styles.doneTitle}>Message envoyé</Text>
        <Text style={styles.doneDesc}>
          Merci ! Notre équipe te répondra par email dès que possible.
        </Text>
        <Pressable style={styles.primaryBtn} onPress={() => router.back()}>
          <Text style={styles.primaryBtnText}>Retour</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Stack.Screen options={{ title: "Contacter le support" }} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.intro}>
          Une question, un bug, une suggestion ? Écris-nous, on te répond par
          email.
        </Text>

        {error && <Text style={styles.error}>{error}</Text>}

        <View style={styles.labelRow}>
          <Text style={styles.label}>Objet *</Text>
          <Text style={styles.counter}>
            {subject.length}/{SUBJECT_MAX}
          </Text>
        </View>
        <TextInput
          placeholderTextColor="#9ca3af"
          style={styles.input}
          placeholder="Objet de ta demande"
          value={subject}
          onChangeText={setSubject}
          maxLength={SUBJECT_MAX}
        />

        <View style={styles.labelRow}>
          <Text style={styles.label}>Message *</Text>
          <Text style={styles.counter}>
            {message.length}/{MESSAGE_MAX}
          </Text>
        </View>
        <TextInput
          placeholderTextColor="#9ca3af"
          style={[styles.input, styles.textarea]}
          placeholder="Décris ta demande…"
          value={message}
          onChangeText={setMessage}
          multiline
          textAlignVertical="top"
          maxLength={MESSAGE_MAX}
        />

        <Pressable
          style={[styles.primaryBtn, (!canSend || sending) && { opacity: 0.5 }]}
          disabled={!canSend || sending}
          onPress={submit}
        >
          <Text style={styles.primaryBtnText}>
            {sending ? "Envoi…" : "Envoyer"}
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  content: { padding: 16, gap: 8 },
  center: {
    flex: 1,
    backgroundColor: "#f9fafb",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    gap: 10,
  },
  intro: { color: "#6b7280", fontSize: 14, lineHeight: 20, marginBottom: 6 },
  error: { color: "#b91c1c", fontSize: 13 },
  labelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginTop: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: "700",
    color: "#374151",
  },
  counter: { fontSize: 11, color: "#9ca3af" },
  input: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    backgroundColor: "#fff",
    color: "#111827",
  },
  textarea: { minHeight: 160 },
  primaryBtn: {
    backgroundColor: "#3b82f6",
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 16,
  },
  primaryBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  doneEmoji: { fontSize: 44 },
  doneTitle: { fontSize: 20, fontWeight: "800", color: "#111827" },
  doneDesc: {
    color: "#6b7280",
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
});
