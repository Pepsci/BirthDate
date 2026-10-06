import { t } from "@/i18n";
import { useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Share,
} from "react-native";
import { Stack } from "expo-router";
import { writeAsStringAsync, documentDirectory } from "expo-file-system/legacy";
import { buildReadableExport } from "../../lib/data-export";
import {
  useTheme,
  useThemedStyles,
  ThemeColors,
} from "../../lib/theme-context";
import { formPane } from "../../lib/layout";

/**
 * Téléchargement des données personnelles (RGPD art. 15 et 20).
 *
 * Le déchiffrement a lieu ici, sur l'appareil : le serveur n'a pas la clé
 * privée et ne peut donc pas produire un export lisible lui-même.
 */
export default function DataExportScreen() {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedPath, setSavedPath] = useState<string | null>(null);

  const run = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    setSavedPath(null);
    try {
      const data = await buildReadableExport();
      const stamp = new Date().toISOString().slice(0, 10);
      const uri = `${documentDirectory}birthreminder-mes-donnees-${stamp}.json`;
      await writeAsStringAsync(uri, JSON.stringify(data, null, 2));
      setSavedPath(uri);
      try {
        await Share.share({ url: uri, title: t("profile:export.fileTitle") });
      } catch {
        // Partage refusé ou indisponible : le fichier reste écrit, on affiche
        // simplement son emplacement.
      }
    } catch (e: any) {
      setError(e?.message ?? t("profile:export.error"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: t("local:data.title") }} />

      <Text style={styles.title}>{t("profile:menu.export")}</Text>
      <Text style={styles.paragraph}>
        {t("profile:export.p1")}
      </Text>
      <Text style={styles.paragraph}>
        {t("profile:export.p2")}
      </Text>
      <Text style={styles.paragraph}>
        {t("profile:export.p3")}
      </Text>

      <Pressable
        style={[styles.button, busy && { opacity: 0.6 }]}
        onPress={run}
        disabled={busy}
      >
        {busy ? (
          <ActivityIndicator color={colors.white} />
        ) : (
          <Text style={styles.buttonText}>{t("profile:export.generate")}</Text>
        )}
      </Pressable>

      {error && <Text style={styles.error}>{error}</Text>}
      {savedPath && (
        <View style={styles.savedBox}>
          <Text style={styles.savedTitle}>{t("profile:export.generated")}</Text>
          <Text style={styles.savedPath} numberOfLines={3}>
            {savedPath.replace(documentDirectory ?? "", "")}
          </Text>
          <Pressable
            onPress={() =>
              Share.share({ url: savedPath, title: t("profile:export.fileTitle") })
            }
          >
            <Text style={styles.shareAgain}>{t("profile:export.shareAgain")}</Text>
          </Pressable>
        </View>
      )}
    </ScrollView>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    content: { padding: 16, gap: 12, paddingBottom: 40, ...formPane },
    title: { fontSize: 20, fontWeight: "800", color: c.text },
    paragraph: { fontSize: 14, color: c.sub, lineHeight: 20 },
    button: {
      backgroundColor: c.primary,
      borderRadius: 12,
      padding: 15,
      alignItems: "center",
      marginTop: 8,
    },
    buttonText: { color: c.white, fontWeight: "700", fontSize: 15 },
    error: { color: c.danger, textAlign: "center" },
    savedBox: {
      backgroundColor: c.card,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: c.border,
      padding: 14,
      gap: 4,
    },
    savedTitle: { fontWeight: "700", color: c.text, fontSize: 14 },
    savedPath: { color: c.sub, fontSize: 12 },
    shareAgain: {
      color: c.primary,
      fontWeight: "700",
      fontSize: 14,
      marginTop: 6,
    },
  });
