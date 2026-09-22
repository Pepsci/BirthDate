import { useState } from "react";
import { View, Text, Pressable, StyleSheet, ScrollView } from "react-native";
import { Stack, Redirect } from "expo-router";
import {
  writeAsStringAsync,
  readDirectoryAsync,
  deleteAsync,
} from "expo-file-system/legacy";
import { useAuth } from "../../lib/auth-context";
import { api } from "../../lib/api";
import { getSocket } from "../../lib/socket";
import { LocalModeUnavailableError } from "../../lib/app-mode";
import {
  readLocal,
  updateLocal,
  newLocalId,
  isLocalId,
  countLocalDates,
  __forgetLocalMemory,
  __LOCAL_DATA_DIR,
} from "../../lib/local-store";
import type { DateEntry } from "../../lib/dates";
import { useThemedStyles, ThemeColors } from "../../lib/theme-context";

/**
 * Écran de test de l'étape 1 du mode local — DEV UNIQUEMENT.
 * Ouvrir : xcrun simctl openurl booted "birthreminder://dev/local-store"
 * À supprimer une fois l'étape 3 (écran de choix) en place.
 */

const TEST_MARK = "__test_local__";

function testCard(i: number): DateEntry {
  return {
    _id: newLocalId(),
    date: new Date(2000, i % 12, (i % 28) + 1).toISOString(),
    name: `${TEST_MARK}${i}`,
    surname: "Test",
    family: false,
    linkedUser: null,
    gifts: [],
  };
}

type Line = { ok: boolean; text: string };

export default function LocalStoreDevScreen() {
  const styles = useThemedStyles(makeStyles);
  const { user, mode, enterLocalMode, leaveLocalMode } = useAuth();
  const [lines, setLines] = useState<Line[]>([]);
  const [busy, setBusy] = useState(false);

  if (!__DEV__) return <Redirect href="/" />;

  const log = (ok: boolean, text: string) =>
    setLines((l) => [...l, { ok, text }]);

  const guarded = (fn: () => Promise<void>) => async () => {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
    } catch (e: any) {
      log(false, `Erreur inattendue : ${e?.message ?? e}`);
    } finally {
      setBusy(false);
    }
  };

  const expectBlocked = async (label: string, call: () => Promise<unknown>) => {
    try {
      await call();
      log(false, `${label} : la requête est partie !`);
    } catch (e) {
      log(
        e instanceof LocalModeUnavailableError,
        e instanceof LocalModeUnavailableError
          ? `${label} : bloqué avant le réseau`
          : `${label} : autre erreur (${(e as Error).message})`,
      );
    }
  };

  const runAll = guarded(async () => {
    setLines([]);
    if (mode !== "local") {
      log(false, "Passe d'abord en mode local.");
      return;
    }
    const before = await countLocalDates();
    log(true, `Cartes au départ : ${before}`);

    // 1. Écriture puis relecture depuis le disque (mémoire oubliée)
    const cards = [1, 2, 3].map(testCard);
    await updateLocal("dates", (items) => [...items, ...cards]);
    __forgetLocalMemory();
    const reread = await readLocal("dates");
    const found = cards.every((c) => reread.some((r) => r._id === c._id));
    log(found, `Écriture + relecture disque : ${found ? "3/3" : "manquantes"}`);

    // 2. Ids locaux
    const idsOk = cards.every((c) => isLocalId(c._id));
    const unique = new Set(cards.map((c) => c._id)).size === cards.length;
    log(idsOk && unique, `Ids locaux : ${cards[0]._id} (uniques : ${unique})`);

    // 3. 20 écritures lancées en même temps : aucune ne doit se perdre
    const burst = Array.from({ length: 20 }, (_, i) => testCard(100 + i));
    await Promise.all(
      burst.map((c) => updateLocal("dates", (items) => [...items, c])),
    );
    __forgetLocalMemory();
    const afterBurst = (await readLocal("dates")).length;
    log(
      afterBurst === before + 23,
      `Écritures simultanées : ${afterBurst - before - 3}/20 conservées`,
    );

    // 4. Fichier principal corrompu → reprise sur le .bak
    const snapshot = await readLocal("dates");
    const main = `${__LOCAL_DATA_DIR}dates.json`;
    await writeAsStringAsync(
      `${main}.bak`,
      JSON.stringify({ schemaVersion: 1, updatedAt: 0, items: snapshot }),
    );
    await writeAsStringAsync(main, "{ceci n'est pas du JSON");
    __forgetLocalMemory();
    const recovered = (await readLocal("dates")).length;
    log(
      recovered === snapshot.length,
      `Fichier corrompu : ${recovered}/${snapshot.length} cartes récupérées du .bak`,
    );

    // 5. Rien ne part sur le réseau
    await expectBlocked("api GET /date", () => api("/date"));
    await expectBlocked("socket", () => getSocket());

    // Nettoyage : cartes de test et fichiers mis de côté
    await updateLocal("dates", (items) =>
      items.filter((d) => !d.name.startsWith(TEST_MARK)),
    );
    const files = await readDirectoryAsync(__LOCAL_DATA_DIR);
    await Promise.all(
      files
        .filter((f) => f.includes(".corrupt-"))
        .map((f) => deleteAsync(`${__LOCAL_DATA_DIR}${f}`, { idempotent: true })),
    );
    const end = await countLocalDates();
    log(end === before, `Nettoyage : ${end} carte(s), comme au départ`);
  });

  const addOne = guarded(async () => {
    const card = testCard(Math.floor(Math.random() * 1000));
    card.name = `Persistante ${new Date().toLocaleTimeString()}`;
    await updateLocal("dates", (items) => [...items, card]);
    log(true, `Ajoutée : ${card.name}`);
  });

  const showDisk = guarded(async () => {
    __forgetLocalMemory();
    const items = await readLocal("dates");
    log(true, `Sur le disque : ${items.length} carte(s)`);
    items.slice(0, 5).forEach((d) => log(true, `• ${d.name} (${d._id})`));
  });

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: "Test mode local" }} />
      <Text style={styles.status}>
        Mode : {mode ?? "non choisi"} · Compte : {user ? "connecté" : "aucun"}
      </Text>

      <View style={styles.row}>
        <Btn label="Passer en local" onPress={guarded(enterLocalMode)} busy={busy} />
        <Btn label="Test complet" onPress={runAll} busy={busy} primary />
      </View>
      <View style={styles.row}>
        <Btn label="Ajouter 1 carte" onPress={addOne} busy={busy} />
        <Btn label="Relire le disque" onPress={showDisk} busy={busy} />
      </View>
      <Btn
        label="Quitter le mode local (efface tout)"
        onPress={guarded(async () => {
          await leaveLocalMode();
          log(true, "Données locales effacées, mode remis à zéro.");
        })}
        busy={busy}
        danger
      />

      <View style={styles.log}>
        {lines.map((l, i) => (
          <Text key={i} style={l.ok ? styles.ok : styles.ko}>
            {l.ok ? "✓" : "✗"} {l.text}
          </Text>
        ))}
      </View>
    </ScrollView>
  );
}

function Btn({
  label,
  onPress,
  busy,
  primary,
  danger,
}: {
  label: string;
  onPress: () => void;
  busy: boolean;
  primary?: boolean;
  danger?: boolean;
}) {
  const styles = useThemedStyles(makeStyles);
  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      style={[
        styles.btn,
        primary && styles.btnPrimary,
        danger && styles.btnDanger,
        busy && styles.btnBusy,
      ]}
    >
      <Text style={primary || danger ? styles.btnTextOn : styles.btnText}>
        {label}
      </Text>
    </Pressable>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    content: { padding: 16, gap: 10, paddingBottom: 40 },
    status: { color: c.sub, fontSize: 13 },
    row: { flexDirection: "row", gap: 10 },
    btn: {
      flex: 1,
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 12,
      padding: 12,
      alignItems: "center",
    },
    btnPrimary: { backgroundColor: c.primary, borderColor: c.primary },
    btnDanger: { backgroundColor: c.danger, borderColor: c.danger },
    btnBusy: { opacity: 0.6 },
    btnText: { color: c.text, fontWeight: "700", fontSize: 14 },
    btnTextOn: { color: c.white, fontWeight: "700", fontSize: 14 },
    log: {
      backgroundColor: c.card,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: c.border,
      padding: 12,
      gap: 4,
    },
    ok: { color: c.successStrong, fontSize: 13 },
    ko: { color: c.danger, fontSize: 13 },
  });
