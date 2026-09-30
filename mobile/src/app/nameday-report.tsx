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
import { Stack, useRouter, useLocalSearchParams } from "expo-router";
import NamedayPicker from "../components/NamedayPicker";
import { reportNameday } from "../lib/support";
import {
  useTheme,
  useThemedStyles,
  ThemeColors,
} from "../lib/theme-context";
import { formPane } from "../lib/layout";

const NAME_MAX = 60;
const COMMENT_MAX = 1000;

/**
 * Signaler une fête incorrecte (ou manquante).
 *
 * Accès : Contact → « Une fête incorrecte ? », ou le lien sous la fête d'une
 * carte (prénom pré-rempli via ?name=). Compte uniquement : en mode local,
 * rien ne part vers le serveur (docs/MODE_LOCAL.md) et les deux entrées sont
 * masquées.
 *
 * Même formulaire que le web (front/…/NamedayReportForm.jsx) : prénom, bonne
 * date si connue, précision libre. Le serveur construit le ticket.
 */
export default function NamedayReportScreen() {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  const router = useRouter();
  const { name: initialName } = useLocalSearchParams<{ name?: string }>();

  const [name, setName] = useState(
    String(initialName || "").slice(0, NAME_MAX),
  );
  const [expectedDate, setExpectedDate] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const canSend = name.trim().length > 0 && !sending;

  const submit = async () => {
    if (!canSend) return;
    setSending(true);
    setError(null);
    try {
      await reportNameday(name.trim(), expectedDate, comment.trim());
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
        <Stack.Screen options={{ title: "Fête incorrecte" }} />
        <Text style={styles.doneEmoji}>🌸</Text>
        <Text style={styles.doneTitle}>Merci !</Text>
        <Text style={styles.doneDesc}>
          On vérifie la fête de {name.trim()} et on corrige le calendrier pour
          tout le monde. Notre réponse arrivera dans Messages → Support.
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
      <Stack.Screen options={{ title: "Fête incorrecte" }} />
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.intro}>
          Un prénom fêté à la mauvaise date, ou pas fêté du tout ? Dis-nous
          lequel : on corrige le calendrier pour tout le monde.
        </Text>

        <Text style={styles.label}>Prénom concerné *</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={(t) => setName(t.slice(0, NAME_MAX))}
          placeholder="Ex : Mia, Jean-Luc…"
          placeholderTextColor={colors.placeholder}
          autoCapitalize="words"
        />

        <Text style={styles.label}>Bonne date (si tu la connais)</Text>
        <NamedayPicker value={expectedDate} onChange={setExpectedDate} />

        <View style={styles.labelRow}>
          <Text style={styles.label}>Précision (optionnel)</Text>
          <Text style={styles.counter}>
            {comment.length}/{COMMENT_MAX}
          </Text>
        </View>
        <TextInput
          style={[styles.input, styles.textarea]}
          value={comment}
          onChangeText={(t) => setComment(t.slice(0, COMMENT_MAX))}
          placeholder="Ex : dans ma famille on la fête le 15 août"
          placeholderTextColor={colors.placeholder}
          multiline
          textAlignVertical="top"
        />

        {error && <Text style={styles.error}>{error}</Text>}

        <Pressable
          style={[styles.primaryBtn, !canSend && styles.disabled]}
          onPress={submit}
          disabled={!canSend}
        >
          <Text style={styles.primaryBtnText}>
            {sending ? "Envoi…" : "Signaler"}
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    content: { padding: 16, gap: 8, paddingBottom: 40, ...formPane },
    intro: { color: c.sub, fontSize: 14, lineHeight: 20, marginBottom: 6 },
    labelRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-end",
      marginTop: 6,
    },
    label: { fontSize: 13, fontWeight: "700", color: c.text, marginTop: 6 },
    counter: { fontSize: 11, color: c.faint },
    input: {
      borderWidth: 1,
      borderColor: c.inputBorder,
      borderRadius: 10,
      padding: 12,
      fontSize: 14,
      backgroundColor: c.inputBg,
      color: c.text,
    },
    textarea: { minHeight: 90 },
    error: { color: c.danger, fontSize: 13 },
    primaryBtn: {
      backgroundColor: c.primary,
      borderRadius: 10,
      paddingVertical: 14,
      alignItems: "center",
      marginTop: 16,
      alignSelf: "stretch",
    },
    disabled: { opacity: 0.5 },
    primaryBtnText: { color: c.white, fontWeight: "700", fontSize: 15 },
    center: {
      flex: 1,
      backgroundColor: c.bg,
      justifyContent: "center",
      alignItems: "center",
      padding: 24,
      gap: 10,
    },
    doneEmoji: { fontSize: 44 },
    doneTitle: { fontSize: 20, fontWeight: "800", color: c.text },
    doneDesc: {
      color: c.sub,
      fontSize: 14,
      textAlign: "center",
      lineHeight: 20,
    },
  });
