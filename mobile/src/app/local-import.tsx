import { useEffect, useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from "react-native";
import { Stack, useRouter } from "expo-router";
import { useAuth } from "../lib/auth-context";
import {
  countLocalDataToImport,
  discardLocalData,
  importLocalIntoAccount,
  ImportProgress,
  MigrationResult,
} from "../lib/local-migration";
import {
  useTheme,
  useThemedStyles,
  ThemeColors,
} from "../lib/theme-context";
import { readingPane } from "../lib/layout";

/**
 * Import des cartes du mode local dans le compte qui vient d'être connecté
 * (docs/MODE_LOCAL.md § 3.3). Affiché automatiquement par _layout tant que
 * des données locales restent sur le téléphone ; « Plus tard » le repousse
 * au prochain lancement, et il reste accessible depuis le profil.
 */
export default function LocalImportScreen() {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  const router = useRouter();
  const { refreshLocalImport, postponeLocalImport } = useAuth();
  const [counts, setCounts] = useState<{ dates: number; wishlist: number } | null>(null);
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [result, setResult] = useState<MigrationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    countLocalDataToImport().then(setCounts).catch(() => setCounts({ dates: 0, wishlist: 0 }));
  }, []);

  const running = progress !== null && result === null;

  const start = async () => {
    if (running) return;
    setError(null);
    setResult(null);
    setProgress({ done: 0, total: (counts?.dates ?? 0) + (counts?.wishlist ?? 0) });
    try {
      const r = await importLocalIntoAccount(setProgress);
      setResult(r);
      setCounts(await countLocalDataToImport());
    } catch (e: any) {
      setProgress(null);
      setError(e?.message ?? "L'import n'a pas pu se faire.");
    }
  };

  const finish = async () => {
    await refreshLocalImport();
    router.replace("/");
  };

  const later = () => {
    postponeLocalImport();
    router.replace("/");
  };

  const discard = () => {
    Alert.alert(
      "Ne pas importer ?",
      "Les cartes du mode sans compte seront supprimées de ce téléphone. " +
        "Ton compte n'est pas touché.",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Supprimer",
          style: "destructive",
          onPress: async () => {
            await discardLocalData();
            await finish();
          },
        },
      ],
    );
  };

  const header = <Stack.Screen options={{ title: "Tes cartes", headerLeft: () => null }} />;

  if (!counts) {
    return (
      <View style={styles.center}>
        {header}
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  // ── Résultat ──
  if (result) {
    const ok = result.cleared;
    const parts: string[] = [];
    if (result.cards) parts.push(`${result.cards} carte${result.cards > 1 ? "s" : ""} ajoutée${result.cards > 1 ? "s" : ""}`);
    if (result.merged) parts.push(`${result.merged} déjà dans ton compte, complétée${result.merged > 1 ? "s" : ""}`);
    if (result.wishlist) parts.push(`${result.wishlist} envie${result.wishlist > 1 ? "s" : ""}`);
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {header}
        <Text style={styles.title}>{ok ? "✅ C'est fait !" : "⚠️ Import incomplet"}</Text>
        {parts.length > 0 && <Text style={styles.text}>{parts.join(" · ")}.</Text>}
        {ok ? (
          <Text style={styles.text}>
            Tes cartes sont maintenant dans ton compte, sur tous tes appareils et
            sur le site. Elles ont été retirées du stockage du téléphone.
          </Text>
        ) : (
          <>
            <Text style={styles.text}>
              {result.offline
                ? "La connexion a été perdue en cours de route."
                : "Certaines cartes n'ont pas pu être envoyées :"}
            </Text>
            {result.failures.length > 0 && (
              <View style={styles.failBox}>
                {result.failures.map((f, i) => (
                  <Text key={i} style={styles.failItem}>• {f}</Text>
                ))}
              </View>
            )}
            <Text style={styles.text}>
              Rien n'est perdu : elles restent sur ce téléphone. Réessaie, l'import
              reprendra là où il s'est arrêté, sans créer de doublons.
            </Text>
            <Pressable style={styles.primaryBtn} onPress={start}>
              <Text style={styles.primaryText}>Réessayer</Text>
            </Pressable>
          </>
        )}
        <Pressable style={ok ? styles.primaryBtn : styles.secondaryBtn} onPress={ok ? finish : later}>
          <Text style={ok ? styles.primaryText : styles.secondaryText}>
            {ok ? "Voir mes cartes" : "Plus tard"}
          </Text>
        </Pressable>
      </ScrollView>
    );
  }

  // ── En cours ──
  if (running) {
    return (
      <View style={styles.center}>
        {header}
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.progress}>
          {progress!.done} / {progress!.total}
          {progress!.current ? ` · ${progress!.current}` : ""}
        </Text>
        <Text style={styles.hint}>Garde l'app ouverte pendant l'import.</Text>
      </View>
    );
  }

  // ── Proposition ──
  const n = counts.dates;
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {header}
      <Text style={styles.title}>📱 → ☁️ Importer tes cartes ?</Text>
      <Text style={styles.text}>
        Tu as {n} carte{n > 1 ? "s" : ""}
        {counts.wishlist
          ? ` et ${counts.wishlist} envie${counts.wishlist > 1 ? "s" : ""}`
          : ""}{" "}
        créée{n > 1 ? "s" : ""} sans compte sur ce téléphone. Importe-les dans ton
        compte pour les retrouver partout, avec leurs idées de cadeaux, leurs
        photos et leurs rappels.
      </Text>
      <Text style={styles.hint}>
        Une carte déjà présente dans ton compte (même prénom, nom et date) n'est
        pas recréée : ses idées de cadeaux y sont simplement ajoutées.
      </Text>
      {error && <Text style={styles.error}>{error}</Text>}

      <Pressable style={styles.primaryBtn} onPress={start}>
        <Text style={styles.primaryText}>
          Importer {n > 0 ? `mes ${n} carte${n > 1 ? "s" : ""}` : "ma liste d'envies"}
        </Text>
      </Pressable>
      <Pressable style={styles.secondaryBtn} onPress={later}>
        <Text style={styles.secondaryText}>Plus tard</Text>
      </Pressable>
      <Pressable onPress={discard}>
        <Text style={styles.discard}>Ne pas importer</Text>
      </Pressable>
    </ScrollView>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    content: { padding: 20, gap: 14, paddingBottom: 40, ...readingPane },
    center: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      gap: 12,
      padding: 24,
      backgroundColor: c.bg,
    },
    title: { fontSize: 22, fontWeight: "800", color: c.text, marginTop: 8 },
    text: { fontSize: 15, color: c.text, lineHeight: 22 },
    hint: { fontSize: 13, color: c.sub, lineHeight: 19, textAlign: "center" },
    progress: { fontSize: 16, fontWeight: "700", color: c.text },
    error: { fontSize: 14, color: c.danger },
    failBox: { backgroundColor: c.dangerSoft, borderRadius: 12, padding: 12, gap: 4 },
    failItem: { fontSize: 14, color: c.text },
    primaryBtn: {
      backgroundColor: c.primary,
      borderRadius: 10,
      paddingVertical: 14,
      alignItems: "center",
      marginTop: 6,
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
    discard: {
      color: c.faint,
      fontSize: 13,
      textAlign: "center",
      textDecorationLine: "underline",
      marginTop: 8,
    },
  });
