import { getLocaleTag, t, tn } from "@/i18n";
import { useCallback, useState } from "react";
import {
  View,
  Text,
  Switch,
  Pressable,
  StyleSheet,
  ScrollView,
  Linking,
  ActivityIndicator,
} from "react-native";
import { Stack, useFocusEffect } from "expo-router";
import {
  getReminderPermission,
  listScheduledLocalReminders,
  rescheduleLocalReminders,
  sendTestReminder,
  ReminderPermission,
} from "../../lib/local-reminders";
import { readLocal, updateLocal } from "../../lib/local-store";
import {
  useTheme,
  useThemedStyles,
  ThemeColors,
} from "../../lib/theme-context";
import { readingPane } from "../../lib/layout";

/**
 * Rappels du mode local (sans compte). En mode compte, les rappels sont
 * réglés dans Profil → Notifications (push envoyés par le serveur).
 *
 * Le réglage par personne (veille, semaine avant, jour J…) reste sur la
 * carte de chacun, comme en mode compte.
 */
export default function LocalRemindersScreen() {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [permission, setPermission] = useState<ReminderPermission | null>(null);
  const [upcoming, setUpcoming] = useState<{ title: string; at: Date | null }[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const prefs = (await readLocal("prefs"))[0];
    setEnabled(prefs?.remindersEnabled !== false);
    setPermission(await getReminderPermission());
    setUpcoming(await listScheduledLocalReminders());
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh().catch(() => {});
    }, [refresh]),
  );

  const toggle = async (value: boolean) => {
    if (busy) return;
    setBusy(true);
    setMsg(null);
    setEnabled(value);
    try {
      await updateLocal("prefs", (items) => [
        { ...(items[0] ?? { _id: "prefs" as const }), remindersEnabled: value },
      ]);
      // Sans attendre le regroupement automatique : l'écran affiche le résultat
      await rescheduleLocalReminders();
      await refresh();
    } catch (e: any) {
      setEnabled(!value);
      setMsg(e?.message ?? t("local:reminders.saveError"));
    } finally {
      setBusy(false);
    }
  };

  const test = async () => {
    setMsg(null);
    const ok = await sendTestReminder();
    setPermission(await getReminderPermission());
    setMsg(
      ok
        ? t("local:reminders.testScheduled")
        : t("local:reminders.denied"),
    );
  };

  if (enabled === null) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title: t("profile:menu.reminders") }} />
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const denied = permission === "denied";
  const next = upcoming[0];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: t("profile:menu.reminders") }} />

      <View style={styles.card}>
        <View style={styles.row}>
          <View style={styles.rowText}>
            <Text style={styles.label}>{t("local:reminders.receive")}</Text>
            <Text style={styles.hint}>
              {t("local:reminders.receiveHint")}
            </Text>
          </View>
          <Switch
            value={enabled}
            disabled={busy}
            onValueChange={toggle}
            trackColor={{ true: colors.primary }}
          />
        </View>
      </View>

      {enabled && denied && (
        <View style={styles.warnBox}>
          <Text style={styles.warnTitle}>{t("local:reminders.offTitle")}</Text>
          <Text style={styles.warnText}>
            {t("local:reminders.offText")}
          </Text>
          <Pressable onPress={() => Linking.openSettings()}>
            <Text style={styles.warnLink}>{t("common:actions.openSettings")}</Text>
          </Pressable>
        </View>
      )}

      {enabled && !denied && (
        <View style={styles.card}>
          <View style={styles.block}>
            <Text style={styles.label}>
              {upcoming.length === 0
                ? t("local:reminders.none")
                : tn("local:reminders.scheduled", upcoming.length)}
            </Text>
            {next && (
              <Text style={styles.hint}>
                {t("local:reminders.next", { title: next.title })}
                {next.at
                  ? `, ${next.at.toLocaleDateString(getLocaleTag(), { weekday: "long", day: "numeric", month: "long" })}`
                  : ""}
              </Text>
            )}
          </View>
        </View>
      )}

      <Text style={styles.explain}>
        {t("local:reminders.explain")}
      </Text>

      <Pressable style={styles.testBtn} onPress={test}>
        <Text style={styles.testBtnText}>{t("local:reminders.test")}</Text>
      </Pressable>
      {msg && <Text style={styles.msg}>{msg}</Text>}
    </ScrollView>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    content: { padding: 12, gap: 12, paddingBottom: 40, ...readingPane },
    center: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: c.bg,
    },
    card: { backgroundColor: c.card, borderRadius: 14, overflow: "hidden" },
    row: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14 },
    rowText: { flex: 1 },
    block: { padding: 14, gap: 4 },
    label: { fontSize: 15, fontWeight: "600", color: c.text },
    hint: { fontSize: 13, color: c.sub, lineHeight: 18, marginTop: 2 },
    warnBox: {
      backgroundColor: c.warningSoft,
      borderRadius: 14,
      padding: 14,
      gap: 6,
    },
    warnTitle: { fontSize: 15, fontWeight: "700", color: c.warningStrong },
    warnText: { fontSize: 13, color: c.warningStrong, lineHeight: 18 },
    warnLink: { fontSize: 14, fontWeight: "700", color: c.primary, marginTop: 4 },
    explain: { fontSize: 13, color: c.sub, lineHeight: 19, paddingHorizontal: 4 },
    testBtn: {
      borderWidth: 1,
      borderColor: c.primary,
      borderRadius: 10,
      paddingVertical: 12,
      alignItems: "center",
    },
    testBtnText: { color: c.primary, fontWeight: "600", fontSize: 15 },
    msg: { fontSize: 13, color: c.sub, textAlign: "center" },
  });
