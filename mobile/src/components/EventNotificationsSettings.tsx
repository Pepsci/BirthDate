import { t } from "@/i18n";
import { useCallback, useEffect, useState } from "react";
import { View, Text, Switch, StyleSheet, ActivityIndicator } from "react-native";
import { Stack } from "expo-router";
import { api } from "../lib/api";
import {
  useTheme,
  useThemedStyles,
  ThemeColors,
} from "../lib/theme-context";
import { formPane } from "../lib/layout";

/**
 * Notifications de CET événement, pour la personne qui consulte.
 *
 * ⚠️ Les catégories dépendent du rôle, et c'est voulu. Les réponses aux
 * invitations, les votes, les cadeaux proposés et les contributions ne partent
 * qu'à l'organisateur : proposer ces interrupteurs à un invité afficherait des
 * réglages sans effet. Le serveur renvoie donc le rôle avec les préférences,
 * et n'accepte que les clés qui lui correspondent.
 *
 * Absentes de cette liste, délibérément : l'annulation et le changement de
 * date. Ce sont les deux seules dont l'utilité est de rattraper quelqu'un qui
 * ne regarde pas l'application : les couper, c'est se déplacer pour rien.
 */
interface Prefs {
  role: "organizer" | "participant";
  prefs: Record<string, boolean>;
}

const LABELS: Record<string, { title: string; hint: string }> = {
  chatMessage: {
    get title() { return t("events:notifs.chatMessage.title"); },
    get hint() { return t("events:notifs.chatMessage.hint"); },
  },
  eventUpdates: {
    get title() { return t("events:notifs.eventUpdates.title"); },
    get hint() { return t("events:notifs.eventUpdates.hint"); },
  },
  rsvp: {
    get title() { return t("events:notifs.rsvp.title"); },
    get hint() { return t("events:notifs.rsvp.hint"); },
  },
  dateVote: { get title() { return t("events:notifs.dateVote.title"); }, get hint() { return t("events:notifs.dateVote.hint"); } },
  locationVote: {
    get title() { return t("events:notifs.locationVote.title"); },
    get hint() { return t("events:notifs.locationVote.hint"); },
  },
  giftProposed: {
    get title() { return t("events:notifs.giftProposed.title"); },
    get hint() { return t("events:notifs.giftProposed.hint"); },
  },
  giftVote: {
    get title() { return t("events:notifs.giftVote.title"); },
    get hint() { return t("events:notifs.giftVote.hint"); },
  },
  poolContribution: {
    get title() { return t("events:notifs.poolContribution.title"); },
    get hint() { return t("events:notifs.poolContribution.hint"); },
  },
};

/** Ordre d'affichage : du plus fréquent au plus rare. */
const ORDER = [
  "chatMessage",
  "eventUpdates",
  "rsvp",
  "dateVote",
  "locationVote",
  "giftProposed",
  "giftVote",
  "poolContribution",
];

/**
 * Réglages de notifications d'UN événement.
 * Écran plein (`app/event/notifications/[shortId].tsx`) ou panneau de droite
 * de la page événement en paysage (`embedded` : pas de titre de pile, qui
 * appartient à l'événement).
 */
export default function EventNotificationsSettings({
  shortId,
  embedded = false,
}: {
  shortId: string;
  embedded?: boolean;
}) {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  const [data, setData] = useState<Prefs | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setData(await api<Prefs>(`/events/${shortId}/my-notifications`));
    } catch (e: any) {
      setError(e?.message ?? t("common:errors.loading"));
    }
  }, [shortId]);

  useEffect(() => {
    load();
  }, [load]);

  const toggle = async (key: string, value: boolean) => {
    if (!data || busy) return;
    // Bascule optimiste : un interrupteur qui attend l'aller-retour réseau
    // donne l'impression de ne pas répondre.
    setData({ ...data, prefs: { ...data.prefs, [key]: value } });
    setBusy(true);
    try {
      setData(
        await api<Prefs>(`/events/${shortId}/my-notifications`, {
          method: "PUT",
          body: JSON.stringify({ [key]: value }),
        }),
      );
    } catch (e: any) {
      setError(e?.message ?? t("common:errors.generic"));
      await load();
    } finally {
      setBusy(false);
    }
  };

  if (!data) {
    return (
      <View style={styles.center}>
        {!embedded && <Stack.Screen options={{ title: t("events:notifs.short") }} />}
        {error ? (
          <Text style={styles.error}>{error}</Text>
        ) : (
          <ActivityIndicator size="large" color={colors.primary} />
        )}
      </View>
    );
  }

  const keys = ORDER.filter((k) => k in data.prefs);

  return (
    <View style={styles.container}>
      {embedded ? (
        <Text style={styles.embeddedTitle}>{t("events:notifs.btn")}</Text>
      ) : (
        <Stack.Screen options={{ title: t("events:notifs.screenTitle") }} />
      )}
      {error && <Text style={styles.error}>{error}</Text>}

      <View style={styles.card}>
        {keys.map((k) => (
          <View key={k} style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>{LABELS[k].title}</Text>
              <Text style={styles.rowHint}>{LABELS[k].hint}</Text>
            </View>
            <Switch
              value={data.prefs[k]}
              onValueChange={(v) => toggle(k, v)}
              trackColor={{ true: colors.primary }}
            />
          </View>
        ))}
      </View>

      <Text style={styles.footer}>
        {t("events:notifs.footer")}
      </Text>
    </View>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg, padding: 12, gap: 12, ...formPane },
    embeddedTitle: { fontSize: 16, fontWeight: "700", color: c.text },
    center: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: c.bg,
    },
    error: { color: c.danger, textAlign: "center", padding: 8 },
    card: {
      backgroundColor: c.card,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: c.border,
      paddingHorizontal: 14,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingVertical: 12,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.border,
    },
    rowTitle: { color: c.text, fontWeight: "700", fontSize: 14.5 },
    rowHint: { color: c.sub, fontSize: 12, marginTop: 2 },
    footer: { color: c.sub, fontSize: 12, lineHeight: 18, paddingHorizontal: 4 },
  });
