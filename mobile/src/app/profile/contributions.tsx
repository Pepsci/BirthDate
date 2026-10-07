import { getLocaleTag, t, tn } from "@/i18n";
import { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { Stack, useRouter } from "expo-router";
import { MyContribution, fetchMyContributions } from "../../lib/events";
import {
  useTheme,
  useThemedStyles,
  ThemeColors,
} from "../../lib/theme-context";
import { readingPane } from "../../lib/layout";

/*
 * Historique des contributions.
 *
 * ⚠️ Cet écran est une PREUVE, pas une commodité.
 *
 * En charges directes, l'argent d'une contribution part directement chez
 * l'organisateur. BirthReminder ne le détient jamais et ne peut pas rembourser
 * à sa place. Le contributeur n'a donc qu'un interlocuteur : et il n'avait,
 * jusqu'ici, plus aucune trace de ce qu'il avait versé une fois l'écran fermé.
 * Réclamer sans montant, sans date et sans référence est très difficile.
 */

const euros = (cents: number) =>
  ((cents || 0) / 100).toLocaleString(getLocaleTag(), {
    style: "currency",
    currency: "EUR",
  });

const formatDate = (d: string) =>
  new Date(d).toLocaleDateString(getLocaleTag(), {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

export default function MyContributionsScreen() {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  const router = useRouter();

  const [contributions, setContributions] = useState<MyContribution[] | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    fetchMyContributions()
      .then(setContributions)
      .catch(() =>
        setError(t("pool:mine.loadError")),
      );
  }, []);

  /*
   * On copie un RÉCAPITULATIF, pas la référence seule : un identifiant Stripe
   * collé tout nu ne dit rien à personne. L'organisateur reconnaît « 25 € le
   * 19 juin », pas un `pi_3To…`. La référence l'accompagne parce qu'elle lève
   * toute ambiguïté côté support, mais elle ne remplace pas le message.
   */
  const copySummary = async (c: MyContribution) => {
    const lines = [
      t("pool:mine.sum.contribution", { amount: euros(c.amount) }),
      c.event ? t("pool:mine.sum.event", { title: c.event.title }) : null,
      t("pool:mine.sum.date", { date: formatDate(c.createdAt) }),
      c.event?.organizer ? t("pool:mine.sum.collectedBy", { name: c.event.organizer }) : null,
      t("pool:mine.sum.reference", { ref: c.reference }),
    ].filter(Boolean);

    await Clipboard.setStringAsync(lines.join("\n"));
    setCopied(c.id);
    setTimeout(() => setCopied(null), 2000);
  };

  /*
   * Ouvre le support avec la contribution déjà décrite.
   *
   * La dernière question du gabarit, « ai-je contacté l'organisateur ? »,
   * est la plus utile : c'est la première marche de la procédure, et la
   * grande majorité des situations se règlent là. Connaître la réponse dès le
   * premier message évite un aller-retour.
   */
  const reportIssue = (c: MyContribution) => {
    const lines = [
      t("pool:mine.report.mine"),
      t("pool:mine.sum.amount", { amount: euros(c.amount) }),
      t("pool:mine.sum.date", { date: formatDate(c.createdAt) }),
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
    ];
    router.push({
      pathname: "/support",
      params: {
        poolSubject: c.event
          ? t("pool:mine.report.subjectFor", { title: c.event.title })
          : t("pool:mine.report.subject"),
        poolMessage: lines.join("\n"),
        // Rattache le ticket à cette cagnotte : lien direct côté admin, et
        // dérogation à la règle du ticket unique côté serveur.
        eventShortId: c.event?.shortId ?? "",
      },
    });
  };

  const total = (contributions ?? [])
    .filter((c) => c.status === "succeeded")
    .reduce((sum, c) => sum + c.amount, 0);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: t("pool:mine.title") }} />

      {error && <Text style={styles.error}>{error}</Text>}

      {!contributions && !error && (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 24 }} />
      )}

      {contributions && contributions.length === 0 && (
        <Text style={styles.empty}>
          {t("pool:mine.empty")}
        </Text>
      )}

      {contributions && contributions.length > 0 && (
        <>
          <Text style={styles.total}>
            {tn("pool:mine.total", contributions.length, { amount: euros(total) })}
          </Text>

          {contributions.map((c) => (
            <View
              key={c.id}
              style={[
                styles.card,
                c.status === "refunded" && styles.cardRefunded,
              ]}
            >
              <View style={styles.head}>
                <Text style={styles.amount}>{euros(c.amount)}</Text>
                <View
                  style={[
                    styles.tag,
                    c.status === "refunded" ? styles.tagRefunded : styles.tagOk,
                  ]}
                >
                  <Text
                    style={[
                      styles.tagText,
                      c.status === "refunded"
                        ? styles.tagTextRefunded
                        : styles.tagTextOk,
                    ]}
                  >
                    {c.status === "refunded" ? t("pool:mine.refunded") : t("pool:mine.paid")}
                  </Text>
                </View>
              </View>

              {c.event ? (
                <Text
                  style={styles.eventLink}
                  onPress={() => router.push(`/event/${c.event!.shortId}`)}
                >
                  {c.event.title}
                </Text>
              ) : (
                <Text style={styles.eventGone}>{t("pool:mine.eventDeleted")}</Text>
              )}

              <Text style={styles.meta}>
                {formatDate(c.createdAt)}
                {c.event?.organizer ? t("pool:mine.collectedBy", { name: c.event.organizer }) : ""}
                {c.status === "refunded" && c.refundedAt
                  ? t("pool:mine.refundedOn", { date: formatDate(c.refundedAt) })
                  : ""}
              </Text>

              <Pressable style={styles.refBox} onPress={() => copySummary(c)}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.refLabel}>{t("pool:mine.reference")}</Text>
                  <Text style={styles.refValue}>{c.reference}</Text>
                </View>
                <Text style={styles.refAction}>
                  {copied === c.id ? t("pool:mine.copied") : t("pool:mine.copy")}
                </Text>
              </Pressable>

              {c.status !== "refunded" && (
                <Pressable onPress={() => reportIssue(c)} hitSlop={6}>
                  <Text style={styles.reportLink}>
                    {t("pool:mine.problem")}
                  </Text>
                </Pressable>
              )}
            </View>
          ))}

          {/* Dire une fois, clairement, qui détient l'argent : c'est ce qui
              évite qu'on nous réclame un remboursement impossible, et ce qui
              oriente vers le bon interlocuteur. */}
          <View style={styles.note}>
            <Text style={styles.noteText}>
              {t("pool:mine.note1a")}{" "}
              <Text style={styles.noteStrong}>
                {t("pool:mine.note1b")}
              </Text>{" "}
              {t("pool:mine.note1c")}
            </Text>
            <Text style={styles.noteText}>
              {t("pool:mine.note2")}
            </Text>
          </View>
        </>
      )}
    </ScrollView>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    content: { padding: 16, paddingBottom: 40, gap: 10, ...readingPane },
    error: { color: c.danger, fontSize: 14, marginTop: 12 },
    empty: { color: c.sub, fontSize: 14, lineHeight: 21, marginTop: 12 },
    total: { color: c.sub, fontSize: 13, marginBottom: 4 },

    card: {
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 12,
      padding: 14,
      backgroundColor: c.bgSecondary,
      gap: 4,
    },
    cardRefunded: { opacity: 0.72 },

    head: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
    },
    amount: { fontSize: 17, fontWeight: "800", color: c.text },

    tag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
    tagOk: { backgroundColor: c.primarySoft },
    tagRefunded: { backgroundColor: c.border },
    tagText: { fontSize: 11, fontWeight: "700" },
    tagTextOk: { color: c.primary },
    tagTextRefunded: { color: c.sub },

    eventLink: {
      fontSize: 14.5,
      fontWeight: "600",
      color: c.text,
      textDecorationLine: "underline",
    },
    eventGone: { fontSize: 14.5, fontStyle: "italic", color: c.sub },
    meta: { fontSize: 12.5, color: c.sub, lineHeight: 18, marginBottom: 6 },

    refBox: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      borderWidth: 1,
      borderStyle: "dashed",
      borderColor: c.border,
      borderRadius: 8,
      paddingVertical: 8,
      paddingHorizontal: 10,
    },
    refLabel: { fontSize: 10.5, fontWeight: "600", color: c.faint },
    refValue: { fontSize: 11.5, color: c.sub, fontFamily: "Courier" },
    refAction: { fontSize: 12, fontWeight: "700", color: c.primary },
    reportLink: {
      marginTop: 8,
      fontSize: 12.5,
      fontWeight: "600",
      color: c.primary,
      textAlign: "center",
    },

    note: {
      marginTop: 8,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 12,
      padding: 14,
      backgroundColor: c.bgSecondary,
      gap: 8,
    },
    noteText: { fontSize: 12.5, lineHeight: 19, color: c.sub },
    noteStrong: { fontWeight: "700", color: c.text },
  });
