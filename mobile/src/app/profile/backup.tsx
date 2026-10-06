import { getLocaleTag, t, tn } from "@/i18n";
import { useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  Share,
} from "react-native";
import { Stack } from "expo-router";
import {
  BackupFormatError,
  isImportAvailable,
  pickBackupFile,
  summarize,
  type LocalBackup,
} from "../../lib/local-backup";
import {
  restoreBackupIntoAccount,
  writeAccountBackupFile,
  type BackupProgress,
} from "../../lib/account-backup";
import {
  useTheme,
  useThemedStyles,
  ThemeColors,
} from "../../lib/theme-context";
import { readingPane } from "../../lib/layout";

/**
 * Sauvegarde et restauration pour un COMPTE — pendant de
 * app/profile/local-data.tsx, qui fait la même chose sans compte.
 *
 * ⚠️ À ne pas confondre avec « Télécharger mes données »
 * (app/profile/data-export.tsx) : celui-là est l'export RGPD, fait pour être
 * LU (messages déchiffrés compris). Celui-ci est fait pour être REMIS dans
 * l'app, et ne contient donc que ce qui se restaure sans conséquence pour
 * les autres : cartes, idées de cadeaux, photos et wishlist.
 */
export default function AccountBackupScreen() {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  const [busy, setBusy] = useState<"export" | "restore" | null>(null);
  const [progress, setProgress] = useState<BackupProgress | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const importReady = isImportAvailable();

  const doExport = async () => {
    if (busy) return;
    setBusy("export");
    setMsg(null);
    setProgress(null);
    try {
      const uri = await writeAccountBackupFile(setProgress);
      const res = await Share.share({
        url: uri,
        title: t("local:backup.fileTitle"),
      });
      if (res.action === Share.sharedAction) {
        setMsg({ ok: true, text: t("local:backup.saved") });
      }
    } catch (e: any) {
      setMsg({ ok: false, text: e?.message ?? t("local:backup.error") });
    } finally {
      setBusy(null);
      setProgress(null);
    }
  };

  /** Confirmation avant d'écrire dans le compte : on annonce le contenu. */
  const confirmRestore = (backup: LocalBackup) => {
    const s = summarize(backup);
    const when = s.exportedAt
      ? s.exportedAt.toLocaleDateString(getLocaleTag(), {
          day: "numeric",
          month: "long",
          year: "numeric",
        })
      : t("local:backup.unknownDate");
    Alert.alert(
      t("local:restore.title"),
      `${t("local:backup.titleOf", { date: when })} : ${tn("local:count.cards", s.dates)}` +
        `${s.photos ? ` (${tn("local:count.photos", s.photos)})` : ""}` +
        `${s.wishlist ? `, ${tn("gifts:wishCount", s.wishlist)}` : ""}.` +
        t("local:restore.text"),
      [
        { text: t("common:actions.cancel"), style: "cancel" },
        { text: t("profile:e2e.restore"), onPress: () => runRestore(backup) },
      ],
    );
  };

  const runRestore = async (backup: LocalBackup) => {
    setBusy("restore");
    setMsg(null);
    setProgress(null);
    try {
      const r = await restoreBackupIntoAccount(backup, setProgress);
      const parts: string[] = [];
      if (r.cards) parts.push(tn("local:restore.cardsAdded", r.cards));
      if (r.merged) parts.push(tn("local:import.alreadyThere", r.merged));
      if (r.wishlist) parts.push(tn("gifts:wishCount", r.wishlist));
      if (r.offline) {
        setMsg({
          ok: false,
          text: t("local:restore.offline"),
        });
      } else if (r.failures.length) {
        setMsg({
          ok: false,
          text: t("local:restore.partial", { list: parts.join(", ") || t("local:restore.nothing"), failures: r.failures.join(", ") }),
        });
      } else {
        setMsg({
          ok: true,
          text: parts.length ? `${parts.join(", ")}.` : t("local:restore.allThere"),
        });
      }
    } catch (e: any) {
      setMsg({ ok: false, text: e?.message ?? t("local:restore.error") });
    } finally {
      setBusy(null);
      setProgress(null);
    }
  };

  const pick = async () => {
    if (busy) return;
    setMsg(null);
    try {
      const backup = await pickBackupFile();
      if (backup) confirmRestore(backup);
    } catch (e: any) {
      setMsg({
        ok: false,
        text:
          e instanceof BackupFormatError
            ? e.message
            : (e?.message ?? t("local:restore.readError")),
      });
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: t("local:backup.title") }} />

      <View style={styles.card}>
        <Text style={styles.label}>{t("local:backup.saveTitle")}</Text>
        <Text style={styles.hint}>
          {t("local:backup.saveText")}
        </Text>
      </View>

      <Pressable
        style={[styles.primaryBtn, busy === "export" && styles.busy]}
        onPress={doExport}
        disabled={!!busy}
      >
        {busy === "export" ? (
          <ActivityIndicator color={colors.white} />
        ) : (
          <Text style={styles.primaryText}>{t("local:backup.save")}</Text>
        )}
      </Pressable>

      <View style={styles.card}>
        <Text style={styles.label}>{t("local:restore.sectionTitle")}</Text>
        <Text style={styles.hint}>
          {t("local:restore.sectionText")}
        </Text>
      </View>

      <Pressable
        style={[styles.secondaryBtn, busy === "restore" && styles.busy]}
        onPress={pick}
        disabled={!!busy || !importReady}
      >
        {busy === "restore" ? (
          <ActivityIndicator color={colors.primary} />
        ) : (
          <Text style={styles.secondaryText}>{t("local:restore.pickFile")}</Text>
        )}
      </Pressable>

      {!importReady && (
        <Text style={styles.hint}>
          {t("local:restore.unavailable")}
        </Text>
      )}

      {progress && progress.total > 0 && (
        <Text style={styles.hint}>
          {progress.done} / {progress.total}
          {progress.current ? ` — ${progress.current}` : ""}
        </Text>
      )}

      {msg && (
        <Text style={msg.ok ? styles.ok : styles.error}>{msg.text}</Text>
      )}

      <Text style={styles.explain}>
        {t("local:backup.scopeNote")}
      </Text>
    </ScrollView>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    content: { padding: 12, gap: 12, paddingBottom: 40, ...readingPane },
    card: { backgroundColor: c.card, borderRadius: 14, padding: 14, gap: 4 },
    label: { fontSize: 15, fontWeight: "700", color: c.text },
    hint: { fontSize: 13, color: c.sub, lineHeight: 19 },
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
    explain: {
      fontSize: 13,
      color: c.sub,
      lineHeight: 19,
      paddingHorizontal: 4,
      marginTop: 8,
    },
  });
