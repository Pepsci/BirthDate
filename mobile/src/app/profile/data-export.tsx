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
        await Share.share({ url: uri, title: "Mes données BirthReminder" });
      } catch {
        // Partage refusé ou indisponible : le fichier reste écrit, on affiche
        // simplement son emplacement.
      }
    } catch (e: any) {
      setError(e?.message ?? "Export impossible pour le moment.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: "Mes données" }} />

      <Text style={styles.title}>Télécharger mes données</Text>
      <Text style={styles.paragraph}>
        Vous obtenez un fichier contenant votre profil, vos dates, vos amis, vos
        listes de cadeaux, vos événements, vos conversations et votre journal
        d'activité.
      </Text>
      <Text style={styles.paragraph}>
        Vos messages sont chiffrés de bout en bout : nos serveurs ne peuvent pas
        les lire. Ils sont déchiffrés sur cet appareil au moment de l'export. Si
        votre clé n'est pas présente ici, les messages concernés apparaîtront
        comme non déchiffrables.
      </Text>
      <Text style={styles.paragraph}>
        Les conversations que vous avez retirées de votre liste figurent dans
        l'export, avec la date à laquelle vous les avez retirées : elles restent
        conservées tant que votre correspondant en a une copie.
      </Text>

      <Pressable
        style={[styles.button, busy && { opacity: 0.6 }]}
        onPress={run}
        disabled={busy}
      >
        {busy ? (
          <ActivityIndicator color={colors.white} />
        ) : (
          <Text style={styles.buttonText}>Générer mon fichier</Text>
        )}
      </Pressable>

      {error && <Text style={styles.error}>{error}</Text>}
      {savedPath && (
        <View style={styles.savedBox}>
          <Text style={styles.savedTitle}>Fichier généré</Text>
          <Text style={styles.savedPath} numberOfLines={3}>
            {savedPath.replace(documentDirectory ?? "", "")}
          </Text>
          <Pressable
            onPress={() =>
              Share.share({ url: savedPath, title: "Mes données BirthReminder" })
            }
          >
            <Text style={styles.shareAgain}>Partager à nouveau</Text>
          </Pressable>
        </View>
      )}
    </ScrollView>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    content: { padding: 16, gap: 12, paddingBottom: 40 },
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
