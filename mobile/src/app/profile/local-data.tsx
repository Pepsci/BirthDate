import { getLocaleTag, t, tn } from "@/i18n";
import { useCallback, useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  Share,
  Alert,
  ActivityIndicator,
} from "react-native";
import { Stack, useFocusEffect, useRouter } from "expo-router";
import { useAuth } from "../../lib/auth-context";
import {
  applyBackup,
  countLocalPhotos,
  getLastBackupAt,
  isImportAvailable,
  LocalBackup,
  markBackupDone,
  pickBackupFile,
  summarize,
  writeBackupFile,
} from "../../lib/local-backup";
import { countLocalDates, readLocal } from "../../lib/local-store";
import {
  useTheme,
  useThemedStyles,
  ThemeColors,
} from "../../lib/theme-context";
import { readingPane } from "../../lib/layout";

/**
 * Sauvegarde / restauration du mode local (docs/MODE_LOCAL.md § 5.5).
 * En mode compte, l'équivalent est « Télécharger mes données »
 * (app/profile/data-export.tsx, export RGPD fourni par le serveur).
 */
export default function LocalDataScreen() {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  const [stats, setStats] = useState<{ dates: number; wishlist: number; photos: number } | null>(null);
  const [lastBackup, setLastBackup] = useState<number | null>(null);
  const [busy, setBusy] = useState<"export" | "import" | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const importReady = isImportAvailable();
  const router = useRouter();
  const { leaveLocalMode } = useAuth();

  // Même double confirmation que dans le profil. Ici, la sauvegarde est
  // juste au-dessus : on le rappelle au lieu de proposer d'y aller.
  const confirmErase = () => {
    Alert.alert(
      t("profile:erase.title"),
      t("local:erase.text") + (lastBackup ? "" : t("local:erase.noBackup")),
      [
        { text: t("common:actions.cancel"), style: "cancel" },
        {
          text: t("common:actions.continue"),
          style: "destructive",
          onPress: () =>
            Alert.alert(
              t("profile:erase.title2"),
              t("profile:erase.text2"),
              [
                { text: t("common:actions.cancel"), style: "cancel" },
                {
                  text: t("profile:erase.action"),
                  style: "destructive",
                  onPress: async () => {
                    try {
                      await leaveLocalMode();
                      router.replace("/welcome");
                    } catch (e: any) {
                      setMsg({ ok: false, text: e?.message ?? t("profile:erase.error") });
                    }
                  },
                },
              ],
            ),
        },
      ],
    );
  };

  const refresh = useCallback(async () => {
    const [dates, wishlist, photos, last] = await Promise.all([
      countLocalDates(),
      readLocal("wishlist").then((w) => w.length),
      countLocalPhotos(),
      getLastBackupAt(),
    ]);
    setStats({ dates, wishlist, photos });
    setLastBackup(last);
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh().catch(() => {});
    }, [refresh]),
  );

  const doExport = async () => {
    if (busy) return;
    setBusy("export");
    setMsg(null);
    try {
      const uri = await writeBackupFile();
      const res = await Share.share({ url: uri, title: t("local:backup.fileTitle") });
      // Compté comme sauvegardé seulement si le fichier est vraiment parti
      // (enregistré dans Fichiers, envoyé par AirDrop, mail…)
      if (res.action === Share.sharedAction) {
        await markBackupDone();
        setMsg({ ok: true, text: t("local:backup.savedKeep") });
        await refresh();
      }
    } catch (e: any) {
      setMsg({ ok: false, text: e?.message ?? t("local:backup.exportError") });
    } finally {
      setBusy(null);
    }
  };

  const apply = async (backup: LocalBackup, mode: "replace" | "merge") => {
    setBusy("import");
    try {
      const r = await applyBackup(backup, mode);
      const parts = [tn("local:import.cardsImported", r.added)];
      if (r.skipped > 0) parts.push(tn("local:import.alreadyThere", r.skipped));
      if (r.wishlistAdded > 0) parts.push(tn("gifts:wishCount", r.wishlistAdded));
      setMsg({ ok: true, text: t("local:import.done", { list: parts.join(", ") }) });
      await refresh();
    } catch (e: any) {
      setMsg({ ok: false, text: e?.message ?? t("local:import.error") });
    } finally {
      setBusy(null);
    }
  };

  const doImport = async () => {
    if (busy) return;
    setMsg(null);
    let backup: LocalBackup | null;
    try {
      setBusy("import");
      backup = await pickBackupFile();
    } catch (e: any) {
      setMsg({ ok: false, text: e?.message ?? t("local:import.unreadable") });
      return;
    } finally {
      setBusy(null);
    }
    if (!backup) return; // annulé

    const s = summarize(backup);
    const when = s.exportedAt
      ? t("local:backup.titleOf", { date: s.exportedAt.toLocaleDateString(getLocaleTag(), { day: "numeric", month: "long", year: "numeric" }) })
      : t("local:backup.title");
    const detail =
      tn("local:count.cards", s.dates) +
      (s.photos ? `, ${tn("local:count.photos", s.photos)}` : "") +
      (s.wishlist ? `, ${tn("gifts:wishCount", s.wishlist)}` : "");
    const hasData = (stats?.dates ?? 0) + (stats?.wishlist ?? 0) > 0;

    if (!hasData) {
      Alert.alert(when, `${detail}.`, [
        { text: t("common:actions.cancel"), style: "cancel" },
        { text: t("local:import.action"), onPress: () => apply(backup!, "replace") },
      ]);
      return;
    }

    Alert.alert(
      when,
      `${detail}.\n\n${t("local:import.mergeOrReplace")}`,
      [
        { text: t("common:actions.cancel"), style: "cancel" },
        { text: t("local:import.merge"), onPress: () => apply(backup!, "merge") },
        {
          text: t("gifts:attach.replace"),
          style: "destructive",
          onPress: () =>
            Alert.alert(
              t("local:import.replaceTitle"),
              t("local:import.replaceText", { count: stats?.dates ?? 0 }),
              [
                { text: t("common:actions.cancel"), style: "cancel" },
                { text: t("gifts:attach.replace"), style: "destructive", onPress: () => apply(backup!, "replace") },
              ],
            ),
        },
      ],
    );
  };

  if (!stats) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title: t("local:data.title") }} />
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const lastLabel = lastBackup
    ? new Date(lastBackup).toLocaleDateString(getLocaleTag(), { day: "numeric", month: "long", year: "numeric" })
    : null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: t("local:data.title") }} />

      <View style={styles.card}>
        <Text style={styles.label}>{t("home:localBadge.title")}</Text>
        <Text style={styles.hint}>
          {tn("local:count.cards", stats.dates)} · {tn("local:count.photos", stats.photos)} · {tn("gifts:wishCount", stats.wishlist)}
        </Text>
        <Text style={lastLabel ? styles.hint : styles.warnText}>
          {lastLabel ? t("local:backup.last", { date: lastLabel }) : t("local:backup.none")}
        </Text>
      </View>

      <Text style={styles.explain}>
        {t("local:data.explain")}
      </Text>

      <Pressable
        style={[styles.primaryBtn, busy !== null && styles.busy]}
        onPress={doExport}
        disabled={busy !== null}
      >
        {busy === "export" ? (
          <ActivityIndicator color={colors.white} />
        ) : (
          <Text style={styles.primaryText}>{t("local:data.export")}</Text>
        )}
      </Pressable>

      {importReady ? (
        <Pressable
          style={[styles.secondaryBtn, busy !== null && styles.busy]}
          onPress={doImport}
          disabled={busy !== null}
        >
          {busy === "import" ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <Text style={styles.secondaryText}>{t("local:data.import")}</Text>
          )}
        </Pressable>
      ) : (
        <Text style={styles.explain}>
          {t("local:data.importSoon")}
        </Text>
      )}

      {msg && <Text style={msg.ok ? styles.ok : styles.error}>{msg.text}</Text>}

      <Pressable onPress={confirmErase} disabled={busy !== null}>
        <Text style={styles.erase}>{t("profile:menu.eraseAll")}</Text>
      </Pressable>
    </ScrollView>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    content: { padding: 12, gap: 12, paddingBottom: 40, ...readingPane },
    center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: c.bg },
    card: { backgroundColor: c.card, borderRadius: 14, padding: 14, gap: 4 },
    label: { fontSize: 15, fontWeight: "700", color: c.text },
    hint: { fontSize: 13, color: c.sub },
    warnText: { fontSize: 13, color: c.warningStrong, fontWeight: "600" },
    explain: { fontSize: 13, color: c.sub, lineHeight: 19, paddingHorizontal: 4 },
    primaryBtn: {
      backgroundColor: c.primary,
      borderRadius: 10,
      paddingVertical: 14,
      alignItems: "center",
    },
    primaryText: { color: c.white, fontWeight: "700", fontSize: 15 },
    secondaryBtn: {
      borderWidth: 1,
      borderColor: c.primary,
      borderRadius: 10,
      paddingVertical: 13,
      alignItems: "center",
    },
    secondaryText: { color: c.primary, fontWeight: "600", fontSize: 15 },
    busy: { opacity: 0.6 },
    ok: { fontSize: 13, color: c.successStrong, textAlign: "center" },
    error: { fontSize: 13, color: c.danger, textAlign: "center" },
    erase: {
      fontSize: 13,
      color: c.danger,
      textAlign: "center",
      textDecorationLine: "underline",
      marginTop: 24,
    },
  });
