import { useCallback, useEffect, useState } from "react";
import { View, Text, Switch, StyleSheet, ActivityIndicator } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import { api } from "../../../lib/api";
import {
  useTheme,
  useThemedStyles,
  ThemeColors,
} from "../../../lib/theme-context";

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
 * ne regarde pas l'application — les couper, c'est se déplacer pour rien.
 */
interface Prefs {
  role: "organizer" | "participant";
  prefs: Record<string, boolean>;
}

const LABELS: Record<string, { title: string; hint: string }> = {
  chatMessage: {
    title: "Messages du chat",
    hint: "Chaque message envoyé dans la discussion.",
  },
  eventUpdates: {
    title: "Mises à jour de l'événement",
    hint: "Lieu retenu, informations modifiées.",
  },
  rsvp: {
    title: "Réponses aux invitations",
    hint: "Quand quelqu'un accepte ou décline.",
  },
  dateVote: { title: "Votes pour la date", hint: "À chaque vote enregistré." },
  locationVote: {
    title: "Votes pour le lieu",
    hint: "À chaque vote enregistré.",
  },
  giftProposed: {
    title: "Cadeaux proposés",
    hint: "Nouvelle idée dans la liste.",
  },
  giftVote: {
    title: "Votes sur les cadeaux",
    hint: "Quand une idée reçoit un vote.",
  },
  poolContribution: {
    title: "Contributions à la cagnotte",
    hint: "Chaque participation reçue.",
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

export default function EventNotificationsScreen() {
  const { shortId } = useLocalSearchParams<{ shortId: string }>();
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  const [data, setData] = useState<Prefs | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setData(await api<Prefs>(`/events/${shortId}/my-notifications`));
    } catch (e: any) {
      setError(e?.message ?? "Erreur de chargement.");
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
      setError(e?.message ?? "Erreur.");
      await load();
    } finally {
      setBusy(false);
    }
  };

  if (!data) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title: "Notifications" }} />
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
      <Stack.Screen options={{ title: "Notifications de l'événement" }} />
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
        L'annulation de l'événement et le changement de date te seront toujours
        notifiés : ce sont les seuls messages qu'on ne peut pas se permettre de
        rater.
      </Text>
    </View>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg, padding: 12, gap: 12 },
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
