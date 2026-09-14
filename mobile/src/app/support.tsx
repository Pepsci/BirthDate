import { useEffect, useState } from "react";
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
import { sendSupportMessage } from "../lib/support";
import {
  MyContribution,
  fetchMyContributions,
} from "../lib/events";
import {
  useTheme,
  useThemedStyles,
  ThemeColors,
} from "../lib/theme-context";

const SUBJECT_MAX = 120;

export default function SupportScreen() {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  const router = useRouter();
  // Contexte optionnel transmis par l'écran de recherche guidée (/contact) :
  // la question consultée qui n'a pas résolu le problème (voir ContactPage
  // côté web pour le même mécanisme).
  //
  // `poolSubject` / `poolMessage` : gabarit préparé par « Mes contributions »
  // pour un litige de cagnotte. Sans lui arrivaient des tickets « j'ai payé
  // quelque part et je n'ai rien reçu », sans montant ni référence — deux
  // allers-retours avant de pouvoir seulement identifier le paiement.
  const { context, poolSubject, poolMessage, eventShortId, poolPicker } =
    useLocalSearchParams<{
      context?: string;
      poolSubject?: string;
      poolMessage?: string;
      eventShortId?: string;
      poolPicker?: string;
    }>();
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  /*
   * Sélection de la cagnotte concernée.
   *
   * ⚠️ Sans elle, un litige arrive en texte libre et il faut deviner
   * l'événement pour retrouver le paiement. Avec elle, le ticket porte
   * l'identifiant : l'admin ouvre directement les contributions. C'est aussi
   * ce qui borne la dérogation à la règle du ticket unique — un ticket ouvert
   * par cagnotte, donc au plus autant que de participations réelles.
   */
  const [pickedEvent, setPickedEvent] = useState<string | null>(null);
  const [contributions, setContributions] = useState<MyContribution[] | null>(
    null,
  );
  // ⚠️ `null` = pas encore choisi ; `""` = choisi mais sans événement
  // identifiable (contribution sans compte, ou événement supprimé). Tester la
  // seule vérité de `pickedEvent` laissait le sélecteur ouvert après un
  // « Continuer sans sélection », puisque la chaîne vide est falsy.
  const picking = poolPicker === "1" && pickedEvent === null;

  useEffect(() => {
    if (poolPicker !== "1") return;
    fetchMyContributions()
      .then(setContributions)
      .catch(() => setContributions([]));
  }, [poolPicker]);

  useEffect(() => {
    if (poolSubject && !subject.trim()) {
      setSubject(String(poolSubject).slice(0, SUBJECT_MAX));
    }
    if (poolMessage && !message.trim()) {
      setMessage(String(poolMessage));
    }
    if (context && !subject.trim()) {
      setSubject(
        `Question non résolue : ${context}`.slice(0, SUBJECT_MAX),
      );
    }
    // On ne réagit qu'au premier montage avec un contexte : ne jamais
    // écraser ce que l'utilisateur a commencé à taper.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const MESSAGE_MAX = 2000;
  const canSend = subject.trim().length > 0 && message.trim().length > 0;

  const submit = async () => {
    if (!canSend || sending) return;
    setSending(true);
    setError(null);
    try {
      const isPool = poolPicker === "1" || Boolean(poolSubject) || Boolean(eventShortId);
      await sendSupportMessage(
        subject.trim(),
        message.trim(),
        pickedEvent || (eventShortId ? String(eventShortId) : undefined),
        isPool ? "pool" : undefined,
      );
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

  // Écran de sélection : on demande de quelle cagnotte il s'agit avant de
  // laisser écrire. Le gabarit se remplit ensuite tout seul.
  if (picking) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Stack.Screen options={{ title: "Problème de cagnotte" }} />
        <Text style={styles.label}>De quelle cagnotte s'agit-il ?</Text>

        {contributions === null ? (
          <Text style={styles.intro}>Chargement…</Text>
        ) : contributions.filter((c) => c.status !== "refunded").length === 0 ? (
          <>
            <Text style={styles.intro}>
              Aucune contribution n'est enregistrée sur ton compte. Si tu as
              participé sans être connecté, décris-nous la situation en
              joignant le reçu reçu par email.
            </Text>
            <Pressable
              style={styles.primaryBtn}
              onPress={() => setPickedEvent("")}
            >
              <Text style={styles.primaryBtnText}>Continuer sans sélection</Text>
            </Pressable>
          </>
        ) : (
          contributions
            .filter((c) => c.status !== "refunded")
            .map((c) => (
              <Pressable
                key={c.id}
                style={styles.poolOption}
                onPress={() => {
                  setPickedEvent(c.event?.shortId ?? "");
                  setSubject(
                    (c.event
                      ? `Problème de cagnotte — ${c.event.title}`
                      : "Problème avec une cagnotte"
                    ).slice(0, SUBJECT_MAX),
                  );
                  setMessage(
                    [
                      "— Ma contribution —",
                      `Montant : ${(c.amount / 100).toFixed(2)} €`,
                      `Date : ${new Date(c.createdAt).toLocaleDateString("fr-FR")}`,
                      c.event ? `Événement : ${c.event.title}` : "Événement : ",
                      c.event?.organizer
                        ? `Encaissé par : ${c.event.organizer}`
                        : "Encaissé par : ",
                      `Référence de paiement : ${c.reference}`,
                      "",
                      "— Ce qui se passe —",
                      "",
                      "",
                      "— Ai-je déjà contacté l'organisateur ? —",
                      "(oui, le … / pas encore)",
                      "",
                    ].join("\n"),
                  );
                }}
              >
                <Text style={styles.poolOptionTitle}>
                  {c.event?.title || "Événement supprimé"}
                </Text>
                <Text style={styles.poolOptionMeta}>
                  {(c.amount / 100).toFixed(2)} € ·{" "}
                  {new Date(c.createdAt).toLocaleDateString("fr-FR")}
                </Text>
              </Pressable>
            ))
        )}
      </ScrollView>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Stack.Screen options={{ title: "Écris-nous" }} />
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
          placeholderTextColor={colors.placeholder}
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
          placeholderTextColor={colors.placeholder}
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

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg },
  content: { padding: 16, gap: 8 },
  poolOption: {
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 10,
    padding: 14,
    backgroundColor: c.bgSecondary,
    marginTop: 8,
  },
  poolOptionTitle: { fontSize: 14.5, fontWeight: "700", color: c.text },
  poolOptionMeta: { fontSize: 12.5, color: c.sub, marginTop: 2 },
  center: {
    flex: 1,
    backgroundColor: c.bg,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    gap: 10,
  },
  intro: { color: c.sub, fontSize: 14, lineHeight: 20, marginBottom: 6 },
  error: { color: c.danger, fontSize: 13 },
  labelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginTop: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: "700",
    color: c.text,
  },
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
  textarea: { minHeight: 160 },
  primaryBtn: {
    backgroundColor: c.primary,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 16,
  },
  primaryBtnText: { color: c.white, fontWeight: "700", fontSize: 15 },
  doneEmoji: { fontSize: 44 },
  doneTitle: { fontSize: 20, fontWeight: "800", color: c.text },
  doneDesc: {
    color: c.sub,
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
});
