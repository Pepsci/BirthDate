import { getLocaleTag, t } from "@/i18n";
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
import { formPane } from "../lib/layout";

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
  // quelque part et je n'ai rien reçu », sans montant ni référence : deux
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
   * ce qui borne la dérogation à la règle du ticket unique : un ticket ouvert
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
        t("support:unresolved", { context }).slice(0, SUBJECT_MAX),
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
      setError(e?.message ?? t("common:errors.send"));
    } finally {
      setSending(false);
    }
  };

  if (sent) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title: t("support:title") }} />
        <Text style={styles.doneEmoji}>✅</Text>
        <Text style={styles.doneTitle}>{t("support:sent.title")}</Text>
        <Text style={styles.doneDesc}>
          {t("support:sent.text")}
        </Text>
        <Pressable style={styles.primaryBtn} onPress={() => router.back()}>
          <Text style={styles.primaryBtnText}>{t("common:actions.back")}</Text>
        </Pressable>
      </View>
    );
  }

  // Écran de sélection : on demande de quelle cagnotte il s'agit avant de
  // laisser écrire. Le gabarit se remplit ensuite tout seul.
  if (picking) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Stack.Screen options={{ title: t("support:pool.title") }} />
        <Text style={styles.label}>{t("support:pool.which")}</Text>

        {contributions === null ? (
          <Text style={styles.intro}>{t("common:status.loading")}</Text>
        ) : contributions.filter((c) => c.status !== "refunded").length === 0 ? (
          <>
            <Text style={styles.intro}>
              {t("support:pool.none")}
            </Text>
            <Pressable
              style={styles.primaryBtn}
              onPress={() => setPickedEvent("")}
            >
              <Text style={styles.primaryBtnText}>{t("support:pool.skip")}</Text>
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
                      ? t("pool:mine.report.subjectFor", { title: c.event.title })
                      : t("pool:mine.report.subject")
                    ).slice(0, SUBJECT_MAX),
                  );
                  setMessage(
                    [
                      t("pool:mine.report.mine"),
                      t("pool:mine.sum.amount", { amount: `${(c.amount / 100).toFixed(2)} €` }),
                      t("pool:mine.sum.date", { date: new Date(c.createdAt).toLocaleDateString(getLocaleTag()) }),
                      t("pool:mine.sum.event", { title: c.event?.title ?? "" }),
                      t("pool:mine.sum.collectedBy", { name: c.event?.organizer ?? "" }),
                      t("pool:mine.sum.reference", { ref: c.reference }),
                      "",
                      t("pool:mine.report.what"),
                      "",
                      "",
                      t("pool:mine.report.contacted"),
                      t("pool:mine.report.contactedHint"),
                      "",
                    ].join("\n"),
                  );
                }}
              >
                <Text style={styles.poolOptionTitle}>
                  {c.event?.title || t("pool:mine.eventDeleted")}
                </Text>
                <Text style={styles.poolOptionMeta}>
                  {(c.amount / 100).toFixed(2)} € ·{" "}
                  {new Date(c.createdAt).toLocaleDateString(getLocaleTag())}
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
      <Stack.Screen options={{ title: t("support:form.title") }} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.intro}>
          {t("support:form.intro")}
        </Text>

        {error && <Text style={styles.error}>{error}</Text>}

        <View style={styles.labelRow}>
          <Text style={styles.label}>{t("support:form.subject")}</Text>
          <Text style={styles.counter}>
            {subject.length}/{SUBJECT_MAX}
          </Text>
        </View>
        <TextInput
          placeholderTextColor={colors.placeholder}
          style={styles.input}
          placeholder={t("support:form.subjectPlaceholder")}
          value={subject}
          onChangeText={setSubject}
          maxLength={SUBJECT_MAX}
        />

        <View style={styles.labelRow}>
          <Text style={styles.label}>{t("support:form.message")}</Text>
          <Text style={styles.counter}>
            {message.length}/{MESSAGE_MAX}
          </Text>
        </View>
        <TextInput
          placeholderTextColor={colors.placeholder}
          style={[styles.input, styles.textarea]}
          placeholder={t("support:form.messagePlaceholder")}
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
            {sending ? t("common:status.sending") : t("chat:reply.send")}
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg },
  content: { padding: 16, gap: 8, ...formPane },
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
