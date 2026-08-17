import { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  Switch,
  Pressable,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { Stack, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { UserProfile, fetchMe, updateMe } from "../../lib/users";
import { DateEntry, fetchDates, setDateNotifications } from "../../lib/dates";
import {
  useTheme,
  useThemedStyles,
  ThemeColors,
} from "../../lib/theme-context";
import { usePersistedCollapse } from "../../lib/collapse-prefs";
import { useScrollBoundsGuard } from "../../lib/use-scroll-bounds-guard";

const COLLAPSE_SCOPE = "profile_notifications";

const PREFS: { key: keyof UserProfile & string; label: string; hint: string }[] = [
  {
    key: "receiveBirthdayEmails",
    label: "Rappels d'anniversaires",
    hint: "Email avant les anniversaires de tes proches",
  },
  {
    key: "receiveNamedayEmails",
    label: "Rappels de fêtes",
    hint: "Email avant les fêtes (nameday) de tes proches",
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
  const insets = useSafeAreaInsets();
  // Voir use-scroll-bounds-guard : les sections repliables font rétrécir le
  // contenu, ce qui laissait la vue calée au-delà de sa propre hauteur.
  const scrollGuard = useScrollBoundsGuard();
  const [me, setMe] = useState<UserProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  // Gestion "par carte" des rappels d'anniversaire, comme sur le web
  // (GestionNotifications > EmailTab) : liste repliée par défaut, un
  // interrupteur par personne pour couper/activer son rappel individuellement.
  const [dates, setDates] = useState<DateEntry[] | null>(null);
  const [updatingDateIds, setUpdatingDateIds] = useState<Set<string>>(
    new Set(),
  );

  // Sections repliables (email / push / rappels par personne), état persisté
  // sur l'appareil pour survivre à une sortie/retour de l'écran.
  const [isEmailSectionExpanded, setIsEmailSectionExpanded] =
    usePersistedCollapse(COLLAPSE_SCOPE, "email", true);
  const [isPushSectionExpanded, setIsPushSectionExpanded] =
    usePersistedCollapse(COLLAPSE_SCOPE, "push", true);
  const [isPersonSectionExpanded, setIsPersonSectionExpanded] =
    usePersistedCollapse(COLLAPSE_SCOPE, "person", true);
  const [isListExpanded, setIsListExpanded] = usePersistedCollapse(
    COLLAPSE_SCOPE,
    "personList",
    false,
  );

  // Ordre alphabétique (nom, prénom) pour retrouver quelqu'un facilement.
  const sortedDates = useMemo(
    () =>
      dates
        ? [...dates].sort((a, b) =>
            `${a.name ?? ""} ${a.surname ?? ""}`.localeCompare(
              `${b.name ?? ""} ${b.surname ?? ""}`,
              "fr",
              { sensitivity: "base" },
            ),
          )
        : null,
    [dates],
  );

  // useFocusEffect (pas juste au montage) : cet écran peut rester monté dans
  // la pile quand on va modifier une préférence ailleurs (ex. Réglages), donc
  // il faut relire /users/me à chaque retour pour ne pas afficher une valeur
  // périmée.
  useFocusEffect(
    useCallback(() => {
      fetchMe()
        .then(setMe)
        .catch((e) => setError(e?.message ?? "Erreur de chargement."));
    }, []),
  );

  useFocusEffect(
    useCallback(() => {
      fetchDates()
        .then(setDates)
        .catch(() => {});
    }, []),
  );

  const toggleDateNotif = async (date: DateEntry) => {
    const enabled = date.receiveNotifications !== false;
    setUpdatingDateIds((prev) => new Set(prev).add(date._id));
    setDates(
      (prev) =>
        prev?.map((d) =>
          d._id === date._id ? { ...d, receiveNotifications: !enabled } : d,
        ) ?? prev,
    );
    try {
      await setDateNotifications(date._id, !enabled);
    } catch (e: any) {
      // rollback
      setDates(
        (prev) =>
          prev?.map((d) =>
            d._id === date._id ? { ...d, receiveNotifications: enabled } : d,
          ) ?? prev,
      );
      setError(e?.message ?? "Erreur d'enregistrement.");
    } finally {
      setUpdatingDateIds((prev) => {
        const next = new Set(prev);
        next.delete(date._id);
        return next;
      });
    }
  };

  const togglePushCat = async (key: string, value: boolean) => {
    if (!me || busy) return;
    setBusy(key);
    setError(null);
    const next = {
      birthdays: me.pushEvents?.birthdays ?? true,
      namedays: me.pushEvents?.namedays ?? true,
      sharedLists: me.pushEvents?.sharedLists ?? true,
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
    <ScrollView
      {...scrollGuard}
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        { paddingBottom: 40 + insets.bottom },
      ]}
    >
      <Stack.Screen options={{ title: "Notifications" }} />
      {error && <Text style={styles.error}>{error}</Text>}

      <Pressable
        style={styles.sectionHeaderRow}
        onPress={() => setIsEmailSectionExpanded(!isEmailSectionExpanded)}
      >
        <Text style={styles.sectionHeader}>✉️ Notifications email</Text>
        <Text style={styles.sectionChevron}>
          {isEmailSectionExpanded ? "▾" : "▸"}
        </Text>
      </Pressable>
      {isEmailSectionExpanded && (
        <View style={styles.card}>
          {/* Levée d'ambiguïté : ces interrupteurs coupaient aussi le push et
              la notif in-app côté serveur (cf. jobs/sendReminders.js). Les
              canaux sont maintenant indépendants — on le dit explicitement,
              sinon « Rappels d'anniversaires : OFF » se lit comme un « ne plus
              rien recevoir ». */}
          <Text style={styles.sectionNote}>
            Ces réglages ne concernent que les emails. En couper un n'affecte ni
            les notifications push, ni le centre de notifications de l'app.
          </Text>
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
      )}

      <Pressable
        style={styles.sectionHeaderRow}
        onPress={() => setIsPushSectionExpanded(!isPushSectionExpanded)}
      >
        <Text style={styles.sectionHeader}>📱 Notifications push (mobile)</Text>
        <Text style={styles.sectionChevron}>
          {isPushSectionExpanded ? "▾" : "▸"}
        </Text>
      </Pressable>
      {isPushSectionExpanded && (
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
                { k: "birthdays", l: "Anniversaires", h: "Rappels J-x selon tes réglages par personne" },
                // Séparé des anniversaires : les deux partageaient le même
                // interrupteur, on ne pouvait pas garder l'un sans l'autre.
                { k: "namedays", l: "Fêtes", h: "Rappels de fêtes (prénoms)" },
                { k: "events", l: "Événements", h: "Invitations, RSVP, votes, rappels" },
                { k: "chat", l: "Messages", h: "Chats privés et d'événements" },
                { k: "friends", l: "Amis", h: "Demandes et acceptations" },
                { k: "gifts", l: "Cadeaux", h: "Réservations sur les wishlists et propositions" },
                { k: "sharedLists", l: "Listes communes", h: "Idées ajoutées, modifiées ou retirées par un membre" },
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
      )}

      <Pressable
        style={styles.sectionHeaderRow}
        onPress={() => setIsPersonSectionExpanded(!isPersonSectionExpanded)}
      >
        <Text style={styles.sectionHeader}>🎂 Rappels par personne</Text>
        <Text style={styles.sectionChevron}>
          {isPersonSectionExpanded ? "▾" : "▸"}
        </Text>
      </Pressable>
      {isPersonSectionExpanded && (
        <View style={styles.card}>
          <Pressable
            style={styles.toggleListBtn}
            onPress={() => setIsListExpanded(!isListExpanded)}
          >
            <Text style={styles.toggleListIcon}>{isListExpanded ? "▾" : "▸"}</Text>
            <Text style={styles.toggleListText}>
              {isListExpanded ? "Masquer la liste" : "Afficher la liste"}
            </Text>
            <Text style={styles.toggleListCount}>({dates?.length ?? 0})</Text>
          </Pressable>

          {isListExpanded && (
            <View style={styles.dateList}>
              {!sortedDates ? (
                <ActivityIndicator color={colors.primary} style={{ marginVertical: 10 }} />
              ) : sortedDates.length === 0 ? (
                <Text style={styles.hint}>Aucun anniversaire enregistré.</Text>
              ) : (
                sortedDates.map((date) => {
                  const enabled = date.receiveNotifications !== false;
                  const updating = updatingDateIds.has(date._id);
                  return (
                    <View key={date._id} style={styles.row}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.label}>
                          {date.name} {date.surname ?? ""}
                        </Text>
                        <Text style={styles.hint}>
                          {enabled ? "Rappels activés" : "Rappels désactivés"}
                        </Text>
                      </View>
                      {updating ? (
                        <ActivityIndicator color={colors.primary} />
                      ) : (
                        <Switch
                          value={enabled}
                          onValueChange={() => toggleDateNotif(date)}
                          trackColor={{ true: colors.primary }}
                        />
                      )}
                    </View>
                  );
                })
              )}
            </View>
          )}
        </View>
      )}
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
  sectionNote: {
    fontSize: 12,
    color: c.sub,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 2,
    lineHeight: 17,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 10,
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: "700",
    color: c.sub,
    textTransform: "uppercase",
  },
  sectionChevron: {
    fontSize: 13,
    color: c.faint,
    fontWeight: "700",
  },
  toggleListBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 14,
  },
  toggleListIcon: { fontSize: 13, color: c.faint, fontWeight: "700" },
  toggleListText: { flex: 1, fontSize: 14, fontWeight: "600", color: c.text },
  toggleListCount: { fontSize: 12, color: c.sub },
  dateList: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.border,
  },
});
