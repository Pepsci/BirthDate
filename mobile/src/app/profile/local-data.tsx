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
      "Effacer toutes tes données ?",
      "Tes cartes, idées de cadeaux, photos et ta liste d'envies seront " +
        "supprimées de ce téléphone." +
        (lastBackup ? "" : "\n\nTu n'as encore fait aucune sauvegarde."),
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Continuer",
          style: "destructive",
          onPress: () =>
            Alert.alert(
              "Vraiment tout effacer ?",
              "C'est définitif : sans compte, rien n'est sauvegardé ailleurs.",
              [
                { text: "Annuler", style: "cancel" },
                {
                  text: "Tout effacer",
                  style: "destructive",
                  onPress: async () => {
                    try {
                      await leaveLocalMode();
                      router.replace("/welcome");
                    } catch (e: any) {
                      setMsg({ ok: false, text: e?.message ?? "Effacement impossible." });
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
      const res = await Share.share({ url: uri, title: "Sauvegarde BirthReminder" });
      // Compté comme sauvegardé seulement si le fichier est vraiment parti
      // (enregistré dans Fichiers, envoyé par AirDrop, mail…)
      if (res.action === Share.sharedAction) {
        await markBackupDone();
        setMsg({ ok: true, text: "Sauvegarde enregistrée. Garde ce fichier en lieu sûr." });
        await refresh();
      }
    } catch (e: any) {
      setMsg({ ok: false, text: e?.message ?? "Export impossible." });
    } finally {
      setBusy(null);
    }
  };

  const apply = async (backup: LocalBackup, mode: "replace" | "merge") => {
    setBusy("import");
    try {
      const r = await applyBackup(backup, mode);
      const parts = [`${r.added} carte${r.added > 1 ? "s" : ""} importée${r.added > 1 ? "s" : ""}`];
      if (r.skipped > 0) parts.push(`${r.skipped} déjà présente${r.skipped > 1 ? "s" : ""}`);
      if (r.wishlistAdded > 0) parts.push(`${r.wishlistAdded} envie${r.wishlistAdded > 1 ? "s" : ""}`);
      setMsg({ ok: true, text: `Import terminé : ${parts.join(", ")}.` });
      await refresh();
    } catch (e: any) {
      setMsg({ ok: false, text: e?.message ?? "Import impossible." });
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
      setMsg({ ok: false, text: e?.message ?? "Fichier illisible." });
      return;
    } finally {
      setBusy(null);
    }
    if (!backup) return; // annulé

    const s = summarize(backup);
    const when = s.exportedAt
      ? ` du ${s.exportedAt.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}`
      : "";
    const detail =
      `${s.dates} carte${s.dates > 1 ? "s" : ""}` +
      (s.photos ? `, ${s.photos} photo${s.photos > 1 ? "s" : ""}` : "") +
      (s.wishlist ? `, ${s.wishlist} envie${s.wishlist > 1 ? "s" : ""}` : "");
    const hasData = (stats?.dates ?? 0) + (stats?.wishlist ?? 0) > 0;

    if (!hasData) {
      Alert.alert(`Sauvegarde${when}`, `${detail}.`, [
        { text: "Annuler", style: "cancel" },
        { text: "Importer", onPress: () => apply(backup!, "replace") },
      ]);
      return;
    }

    Alert.alert(
      `Sauvegarde${when}`,
      `${detail}.\n\nFusionner : ajoute ce qui manque, sans doublon.\n` +
        "Remplacer : tes données actuelles sont supprimées.",
      [
        { text: "Annuler", style: "cancel" },
        { text: "Fusionner", onPress: () => apply(backup!, "merge") },
        {
          text: "Remplacer",
          style: "destructive",
          onPress: () =>
            Alert.alert(
              "Remplacer tes données ?",
              `Tes ${stats?.dates ?? 0} cartes actuelles seront remplacées par celles du fichier.`,
              [
                { text: "Annuler", style: "cancel" },
                { text: "Remplacer", style: "destructive", onPress: () => apply(backup!, "replace") },
              ],
            ),
        },
      ],
    );
  };

  if (!stats) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title: "Mes données" }} />
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const lastLabel = lastBackup
    ? new Date(lastBackup).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })
    : null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: "Mes données" }} />

      <View style={styles.card}>
        <Text style={styles.label}>📱 Sur ce téléphone</Text>
        <Text style={styles.hint}>
          {stats.dates} carte{stats.dates > 1 ? "s" : ""} · {stats.photos} photo
          {stats.photos > 1 ? "s" : ""} · {stats.wishlist} envie{stats.wishlist > 1 ? "s" : ""}
        </Text>
        <Text style={lastLabel ? styles.hint : styles.warnText}>
          {lastLabel ? `Dernière sauvegarde : ${lastLabel}` : "Aucune sauvegarde pour l'instant"}
        </Text>
      </View>

      <Text style={styles.explain}>
        Sans compte, tes données n'existent que sur ce téléphone. Une sauvegarde
        est un fichier que tu gardes où tu veux (Fichiers, iCloud Drive, mail…) :
        il te permet de tout retrouver sur un nouveau téléphone ou après avoir
        réinstallé l'app. Photos comprises.
      </Text>

      <Pressable
        style={[styles.primaryBtn, busy !== null && styles.busy]}
        onPress={doExport}
        disabled={busy !== null}
      >
        {busy === "export" ? (
          <ActivityIndicator color={colors.white} />
        ) : (
          <Text style={styles.primaryText}>💾 Exporter une sauvegarde</Text>
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
            <Text style={styles.secondaryText}>📂 Importer une sauvegarde</Text>
          )}
        </Pressable>
      ) : (
        <Text style={styles.explain}>
          L'import sera disponible dans la prochaine version de l'app.
        </Text>
      )}

      {msg && <Text style={msg.ok ? styles.ok : styles.error}>{msg.text}</Text>}

      <Pressable onPress={confirmErase} disabled={busy !== null}>
        <Text style={styles.erase}>Effacer toutes mes données</Text>
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
