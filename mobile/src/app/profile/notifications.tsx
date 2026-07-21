import { useEffect, useState } from "react";
import {
  View,
  Text,
  Switch,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { Stack } from "expo-router";
import { UserProfile, fetchMe, updateMe } from "../../lib/users";
import {
  useTheme,
  useThemedStyles,
  ThemeColors,
} from "../../lib/theme-context";

const PREFS: { key: keyof UserProfile & string; label: string; hint: string }[] = [
  {
    key: "receiveBirthdayEmails",
    label: "Rappels d'anniversaires",
    hint: "Email avant les anniversaires de tes proches",
  },
  {
    key: "receiveOwnBirthdayEmail",
    label: "Mon anniversaire",
    hint: "Email le jour de ton anniversaire",
  },
  {
    key: "receiveFriendRequestEmails",
    label: "Demandes d'amis",
    hint: "Email quand quelqu'un t'ajoute",
  },
  {
    key: "receiveEventEmails",
    label: "Événements",
    hint: "Invitations, rappels J-7/J-1, votes",
  },
  {
    key: "receiveChatEmails",
    label: "Messages non lus",
    hint: "Email récapitulatif des messages manqués",
  },
  {
    key: "monthlyRecap",
    label: "Récap mensuel",
    hint: "Les anniversaires du mois à venir",
  },
];

export default function NotificationsScreen() {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  const [me, setMe] = useState<UserProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    fetchMe()
      .then(setMe)
      .catch((e) => setError(e?.message ?? "Erreur de chargement."));
  }, []);

  const togglePushCat = async (key: string, value: boolean) => {
    if (!me || busy) return;
    setBusy(key);
    setError(null);
    const next = {
      birthdays: me.pushEvents?.birthdays ?? true,
      chat: me.pushEvents?.chat ?? true,
      friends: me.pushEvents?.friends ?? true,
      gifts: me.pushEvents?.gifts ?? true,
      events: me.pushEvents?.events ?? true,
      [key]: value,
    };
    setMe({ ...me, pushEvents: next });
    try {
      // ⚠️ applyPreferences remplace l'objet entier → toujours envoyer complet
      await updateMe({ pushEvents: next });
    } catch (e: any) {
      setMe(me);
      setError(e?.message ?? "Erreur d'enregistrement.");
    } finally {
      setBusy(null);
    }
  };

  const toggle = async (key: string, value: boolean) => {
    if (!me || busy) return;
    setBusy(key);
    setError(null);
    // Optimiste
    setMe({ ...me, [key]: value });
    try {
      await updateMe({ [key]: value });
    } catch (e: any) {
      setMe({ ...me, [key]: !value }); // rollback
      setError(e?.message ?? "Erreur d'enregistrement.");
    } finally {
      setBusy(null);
    }
  };

  if (!me) {
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

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: "Notifications" }} />
      {error && <Text style={styles.error}>{error}</Text>}

      <Text style={styles.sectionHeader}>✉️ Notifications email</Text>
      <View style={styles.card}>
        {PREFS.map((pref) => (
          <View key={pref.key} style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>{pref.label}</Text>
              <Text style={styles.hint}>{pref.hint}</Text>
            </View>
            <Switch
              value={!!me[pref.key]}
              disabled={busy === pref.key}
              onValueChange={(v) => toggle(pref.key, v)}
              trackColor={{ true: colors.primary }}
            />
          </View>
        ))}
      </View>

      <Text style={styles.sectionHeader}>📱 Notifications push (mobile)</Text>
      <View style={styles.card}>
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Push activé</Text>
            <Text style={styles.hint}>
              Notifications natives sur ce téléphone
            </Text>
          </View>
          <Switch
            value={!!me.pushEnabled}
            disabled={busy === "pushEnabled"}
            onValueChange={(v) => toggle("pushEnabled", v)}
            trackColor={{ true: colors.primary }}
          />
        </View>
        {me.pushEnabled &&
          (
            [
              { k: "birthdays", l: "Anniversaires & fêtes", h: "Rappels J-x selon tes réglages par personne" },
              { k: "events", l: "Événements", h: "Invitations, RSVP, votes, rappels" },
              { k: "chat", l: "Messages", h: "Chats privés et d'événements" },
              { k: "friends", l: "Amis", h: "Demandes et acceptations" },
              { k: "gifts", l: "Cadeaux", h: "Réservations et propositions" },
            ] as const
          ).map(({ k, l, h }) => (
            <View key={k} style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>{l}</Text>
                <Text style={styles.hint}>{h}</Text>
              </View>
              <Switch
                value={me.pushEvents?.[k] !== false}
                disabled={busy === k}
                onValueChange={(v) => togglePushCat(k, v)}
                trackColor={{ true: colors.primary }}
              />
            </View>
          ))}
      </View>
    </ScrollView>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg },
  content: { padding: 12, gap: 10 },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: c.bg,
  },
  error: { color: c.danger, textAlign: "center", padding: 8 },
  card: { backgroundColor: c.card, borderRadius: 14, overflow: "hidden" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.border,
  },
  label: { fontSize: 15, fontWeight: "600", color: c.text },
  hint: { fontSize: 12, color: c.sub, marginTop: 1 },
  sectionHeader: {
    fontSize: 13,
    fontWeight: "700",
    color: c.sub,
    textTransform: "uppercase",
    marginTop: 10,
    marginLeft: 4,
  },
});
