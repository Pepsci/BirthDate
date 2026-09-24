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
        title: "Sauvegarde BirthReminder",
      });
      if (res.action === Share.sharedAction) {
        setMsg({ ok: true, text: "Sauvegarde enregistrée." });
      }
    } catch (e: any) {
      setMsg({ ok: false, text: e?.message ?? "Sauvegarde impossible." });
    } finally {
      setBusy(null);
      setProgress(null);
    }
  };

  /** Confirmation avant d'écrire dans le compte : on annonce le contenu. */
  const confirmRestore = (backup: LocalBackup) => {
    const s = summarize(backup);
    const when = s.exportedAt
      ? s.exportedAt.toLocaleDateString("fr-FR", {
          day: "numeric",
          month: "long",
          year: "numeric",
        })
      : "date inconnue";
    Alert.alert(
      "Restaurer cette sauvegarde ?",
      `Sauvegarde du ${when} : ${s.dates} carte${s.dates > 1 ? "s" : ""}` +
        `${s.photos ? ` (${s.photos} photo${s.photos > 1 ? "s" : ""})` : ""}` +
        `${s.wishlist ? ` et ${s.wishlist} envie${s.wishlist > 1 ? "s" : ""}` : ""}.` +
        "\n\nRien ne sera supprimé : seules les cartes absentes de ton compte " +
        "seront ajoutées. Celles qui existent déjà seront complétées.",
      [
        { text: "Annuler", style: "cancel" },
        { text: "Restaurer", onPress: () => runRestore(backup) },
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
      if (r.cards) parts.push(`${r.cards} carte${r.cards > 1 ? "s" : ""} ajoutée${r.cards > 1 ? "s" : ""}`);
      if (r.merged) parts.push(`${r.merged} déjà présente${r.merged > 1 ? "s" : ""}`);
      if (r.wishlist) parts.push(`${r.wishlist} envie${r.wishlist > 1 ? "s" : ""}`);
      if (r.offline) {
        setMsg({
          ok: false,
          text: "Réseau perdu en cours de route. Relance la restauration : ce qui est déjà passé ne sera pas recréé.",
        });
      } else if (r.failures.length) {
        setMsg({
          ok: false,
          text: `${parts.join(", ") || "Rien ajouté"}. N'ont pas pu passer : ${r.failures.join(", ")}.`,
        });
      } else {
        setMsg({
          ok: true,
          text: parts.length ? `${parts.join(", ")}.` : "Tout était déjà dans ton compte.",
        });
      }
    } catch (e: any) {
      setMsg({ ok: false, text: e?.message ?? "Restauration impossible." });
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
            : (e?.message ?? "Lecture du fichier impossible."),
      });
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: "Sauvegarde" }} />

      <View style={styles.card}>
        <Text style={styles.label}>💾 Sauvegarder mes données</Text>
        <Text style={styles.hint}>
          Un fichier avec tes cartes d'anniversaire, leurs idées de cadeaux,
          leurs photos et ta liste d'envies. Range-le où tu veux : Fichiers,
          Drive, un mail que tu t'envoies.
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
          <Text style={styles.primaryText}>Sauvegarder</Text>
        )}
      </Pressable>

      <View style={styles.card}>
        <Text style={styles.label}>↩️ Restaurer une sauvegarde</Text>
        <Text style={styles.hint}>
          Remet dans ton compte les cartes et les envies d'une sauvegarde.
          Rien n'est supprimé, et une carte déjà présente n'est jamais
          dupliquée : tu peux restaurer sans crainte.
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
          <Text style={styles.secondaryText}>Choisir un fichier</Text>
        )}
      </Pressable>

      {!importReady && (
        <Text style={styles.hint}>
          La restauration n'est pas disponible dans cette version de l'app.
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
        Cette sauvegarde ne contient ni tes événements, ni tes cagnottes, ni
        tes listes communes : ce sont des données partagées avec d'autres
        personnes, les restaurer créerait des doublons chez elles. Pour un
        export complet de tout ce que nous détenons sur toi, utilise
        « Télécharger mes données ».
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
