import { useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  TextInput,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { Stack } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../lib/auth-context";
import { api } from "../../lib/api";
import {
  generateSeedPhrase,
  validateSeedPhrase,
  keyPairFromSeed,
  generateKeyPair,
  encryptPrivateKey,
  decryptPrivateKey,
  encryptSeedPhrase,
  decryptSeedPhrase,
  storePrivateKey,
  storeOldPrivateKey,
  getPrivateKey,
  clearPrivateKey,
} from "../../lib/crypto";

// « E2EView » et non « View » pour ne pas masquer le composant View de react-native
type E2EView =
  | "overview"
  | "step1"
  | "step2"
  | "step3"
  | "step4"
  | "view-seed-pw"
  | "view-seed-reveal"
  | "deactivate"
  | "restore";

const normalizeSeed = (s: string) =>
  s
    .replace(/[ ​‌‍﻿]/g, " ")
    .replace(/\n/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

export default function E2EScreen() {
  const { user, refresh } = useAuth();
  const insets = useSafeAreaInsets();

  const [view, setView] = useState<E2EView>("overview");
  const [seedPhrase, setSeedPhrase] = useState("");
  const [seedInput, setSeedInput] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [revealedSeed, setRevealedSeed] = useState("");
  const [info, setInfo] = useState("");

  const userId = String(user?._id ?? "");
  const isFullE2E = (user?.e2eMode as string) === "full";
  const encryptedSeedPhrase = user?.encryptedSeedPhrase as string | undefined;
  const encryptedPrivateKey = user?.encryptedPrivateKey as string | undefined;
  const e2eActivatedAt = user?.e2eActivatedAt as string | undefined;

  const resetFlow = () => {
    setSeedPhrase("");
    setSeedInput("");
    setPassword("");
    setError("");
    setRevealedSeed("");
    setInfo("");
  };

  const go = (v: E2EView) => {
    setError("");
    setView(v);
  };

  // Vérifie le mot de passe en déchiffrant la clé privée existante
  const passwordOk = (pw: string) =>
    !!encryptedPrivateKey &&
    decryptPrivateKey(encryptedPrivateKey, pw, userId) !== null;

  const startStep2 = () => {
    setSeedPhrase(generateSeedPhrase());
    go("step2");
  };

  const verifySeed = () => {
    setError("");
    if (normalizeSeed(seedInput) !== normalizeSeed(seedPhrase)) {
      setError("La phrase ne correspond pas. Vérifie l'ordre exact des 12 mots.");
      return;
    }
    if (!validateSeedPhrase(normalizeSeed(seedInput))) {
      setError("Phrase invalide (mots BIP39 incorrects).");
      return;
    }
    go("step4");
  };

  const activateFullE2E = async () => {
    setError("");
    if (encryptedPrivateKey && !passwordOk(password)) {
      setError("Mot de passe incorrect.");
      return;
    }
    setLoading(true);
    try {
      const { publicKey, secretKey } = keyPairFromSeed(seedPhrase);
      const encPriv = encryptPrivateKey(secretKey, password, userId);
      const encSeed = encryptSeedPhrase(seedPhrase, password, userId);

      await api("/users/keys", {
        method: "PUT",
        body: JSON.stringify({
          publicKey,
          encryptedPrivateKey: encPriv,
          e2eMode: "full",
          encryptedSeedPhrase: encSeed,
        }),
      });

      const currentKey = await getPrivateKey();
      if (currentKey) await storeOldPrivateKey(currentKey);
      await clearPrivateKey();
      await storePrivateKey(secretKey);
      await refresh();

      resetFlow();
      go("overview");
    } catch (e: any) {
      setError(e?.message ?? "Erreur lors de l'activation.");
    } finally {
      setLoading(false);
    }
  };

  const viewSeedPhrase = async () => {
    setError("");
    setLoading(true);
    try {
      const phrase = encryptedSeedPhrase
        ? decryptSeedPhrase(encryptedSeedPhrase, password, userId)
        : null;
      if (!phrase) {
        setError("Mot de passe incorrect.");
        return;
      }
      setRevealedSeed(phrase);
      setPassword("");
      go("view-seed-reveal");
    } finally {
      setLoading(false);
    }
  };

  const deactivate = async () => {
    setError("");
    if (encryptedPrivateKey && !passwordOk(password)) {
      setError("Mot de passe incorrect.");
      return;
    }
    setLoading(true);
    try {
      const { publicKey, secretKey } = generateKeyPair();
      const encPriv = encryptPrivateKey(secretKey, password, userId);

      await api("/users/keys", {
        method: "PUT",
        body: JSON.stringify({
          publicKey,
          encryptedPrivateKey: encPriv,
          e2eMode: "standard",
          encryptedSeedPhrase: null,
        }),
      });

      const currentKey = await getPrivateKey();
      if (currentKey) await storeOldPrivateKey(currentKey);
      await clearPrivateKey();
      await storePrivateKey(secretKey);
      await refresh();

      resetFlow();
      go("overview");
    } catch (e: any) {
      setError(e?.message ?? "Erreur lors de la désactivation.");
    } finally {
      setLoading(false);
    }
  };

  // Recovery : re-dérive la clé depuis la phrase et la stocke sur cet appareil
  const restoreFromSeed = async () => {
    setError("");
    const phrase = normalizeSeed(seedInput);
    if (!validateSeedPhrase(phrase)) {
      setError("Phrase invalide (vérifie les 12 mots).");
      return;
    }
    setLoading(true);
    try {
      const { secretKey } = keyPairFromSeed(phrase);
      await storePrivateKey(secretKey);
      resetFlow();
      setInfo("✅ Clés restaurées sur cet appareil.");
      go("overview");
    } catch (e: any) {
      setError(e?.message ?? "Erreur lors de la restauration.");
    } finally {
      setLoading(false);
    }
  };

  const Err = () => (error ? <Text style={s.error}>{error}</Text> : null);
  const Stepper = ({ n }: { n: number }) => (
    <View style={s.stepper}>
      {[1, 2, 3, 4].map((i) => (
        <View
          key={i}
          style={[
            s.step,
            i < n && s.stepDone,
            i === n && s.stepActive,
          ]}
        >
          <Text style={[s.stepText, i <= n && s.stepTextOn]}>
            {i < n ? "✓" : i}
          </Text>
        </View>
      ))}
    </View>
  );
  const SeedGrid = ({ phrase }: { phrase: string }) => (
    <View style={s.seedGrid}>
      {phrase.split(" ").map((w, i) => (
        <View key={i} style={s.seedWord}>
          <Text style={s.seedNum}>{i + 1}</Text>
          <Text style={s.seedText} selectable>
            {w}
          </Text>
        </View>
      ))}
    </View>
  );

  return (
    <ScrollView
      style={s.container}
      contentContainerStyle={[s.content, { paddingBottom: 40 + insets.bottom }]}
    >
      <Stack.Screen options={{ title: "Chiffrement" }} />

      {!!info && view === "overview" && (
        <Text style={s.infoBanner}>{info}</Text>
      )}

      {/* Overview — standard */}
      {view === "overview" && !isFullE2E && (
        <View style={s.card}>
          <Text style={s.title}>Chiffrement Maximum (Full E2E)</Text>
          <Text style={s.desc}>
            Le mode standard protège déjà tes messages. Le Chiffrement Maximum
            ajoute une sécurité basée sur une phrase de 12 mots — indépendante de
            ton mot de passe.
          </Text>
          <View style={s.infoBox}>
            <Text style={s.infoLine}>
              ✅ Clé non liée à ton mot de passe — plus robuste
            </Text>
            <Text style={s.infoLine}>
              ⚠️ Si tu perds tes 12 mots, tes messages seront inaccessibles
            </Text>
            <Text style={s.infoLine}>
              ⚠️ Les anciens messages ne seront pas re-chiffrés
            </Text>
          </View>
          <Pressable style={s.primaryBtn} onPress={() => go("step1")}>
            <Text style={s.primaryText}>Activer le Chiffrement Maximum</Text>
          </Pressable>
        </View>
      )}

      {/* Overview — full actif */}
      {view === "overview" && isFullE2E && (
        <View style={s.card}>
          <View style={s.activeBadge}>
            <Text style={s.activeBadgeText}>🔐 Chiffrement Maximum actif</Text>
          </View>
          {!!e2eActivatedAt && (
            <Text style={s.meta}>
              Activé le{" "}
              {new Date(e2eActivatedAt).toLocaleDateString("fr-FR", {
                day: "2-digit",
                month: "long",
                year: "numeric",
              })}
            </Text>
          )}
          <Text style={s.desc}>
            Tes messages sont chiffrés avec ta phrase de récupération de 12 mots.
            Conserve-la précieusement — c'est ta seule façon d'accéder à tes
            messages depuis un nouvel appareil.
          </Text>
          {!!encryptedSeedPhrase && (
            <Pressable style={s.secondaryBtn} onPress={() => go("view-seed-pw")}>
              <Text style={s.secondaryText}>Voir ma phrase de récupération</Text>
            </Pressable>
          )}
          <Pressable style={s.secondaryBtn} onPress={() => go("restore")}>
            <Text style={s.secondaryText}>Restaurer mes clés sur cet appareil</Text>
          </Pressable>
          <Pressable style={s.dangerBtn} onPress={() => go("deactivate")}>
            <Text style={s.dangerText}>Désactiver le Chiffrement Maximum</Text>
          </Pressable>
        </View>
      )}

      {/* Step 1 — avertissement */}
      {view === "step1" && (
        <View style={s.card}>
          <Stepper n={1} />
          <Text style={s.title}>⚠️ Avant d'activer</Text>
          <View style={s.infoBox}>
            <Text style={s.infoLine}>
              ✅ Tes messages actuels resteront lisibles (ancienne clé conservée).
            </Text>
            <Text style={s.infoLine}>
              💻 Fonctionne sur tous tes appareils en te reconnectant.
            </Text>
            <Text style={s.infoLine}>
              🔑 Tes 12 mots sont irremplaçables : perdus + mot de passe oublié =
              messages inaccessibles.
            </Text>
            <Text style={s.infoLine}>
              📝 Prépare de quoi noter. 🚫 Pas de capture d'écran.
            </Text>
          </View>
          <View style={s.navRow}>
            <Pressable
              style={s.ghostBtn}
              onPress={() => {
                resetFlow();
                go("overview");
              }}
            >
              <Text style={s.ghostText}>Annuler</Text>
            </Pressable>
            <Pressable style={s.primaryBtn} onPress={startStep2}>
              <Text style={s.primaryText}>J'accepte</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* Step 2 — affichage seed */}
      {view === "step2" && (
        <View style={s.card}>
          <Stepper n={2} />
          <Text style={s.title}>Tes 12 mots de récupération</Text>
          <Text style={s.desc}>
            Note ces mots dans l'ordre exact. Ne les partage jamais.
          </Text>
          <SeedGrid phrase={seedPhrase} />
          <View style={s.warnBox}>
            <Text style={s.warnText}>🔒 Ces mots n'apparaîtront qu'une fois.</Text>
          </View>
          <View style={s.navRow}>
            <Pressable style={s.ghostBtn} onPress={() => go("step1")}>
              <Text style={s.ghostText}>← Retour</Text>
            </Pressable>
            <Pressable
              style={s.primaryBtn}
              onPress={() => {
                setSeedInput("");
                go("step3");
              }}
            >
              <Text style={s.primaryText}>J'ai noté →</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* Step 3 — vérification */}
      {view === "step3" && (
        <View style={s.card}>
          <Stepper n={3} />
          <Text style={s.title}>Vérification</Text>
          <Text style={s.desc}>
            Entre tes 12 mots dans l'ordre exact pour confirmer.
          </Text>
          <TextInput
            style={s.textarea}
            placeholder="mot1 mot2 mot3 … mot12"
            placeholderTextColor="#9ca3af"
            value={seedInput}
            onChangeText={(t) => {
              setSeedInput(t);
              setError("");
            }}
            multiline
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Err />
          <View style={s.navRow}>
            <Pressable style={s.ghostBtn} onPress={() => go("step2")}>
              <Text style={s.ghostText}>← Retour</Text>
            </Pressable>
            <Pressable
              style={[s.primaryBtn, !seedInput.trim() && s.disabled]}
              disabled={!seedInput.trim()}
              onPress={verifySeed}
            >
              <Text style={s.primaryText}>Vérifier →</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* Step 4 — mot de passe */}
      {view === "step4" && (
        <View style={s.card}>
          <Stepper n={4} />
          <Text style={s.title}>Confirme ton mot de passe</Text>
          <Text style={s.desc}>
            Il sécurise ta nouvelle clé de chiffrement.
          </Text>
          <TextInput
            style={s.input}
            placeholder="Mot de passe"
            placeholderTextColor="#9ca3af"
            secureTextEntry
            value={password}
            onChangeText={(t) => {
              setPassword(t);
              setError("");
            }}
            autoCapitalize="none"
          />
          <Err />
          <View style={s.navRow}>
            <Pressable
              style={s.ghostBtn}
              onPress={() => {
                setPassword("");
                go("step3");
              }}
            >
              <Text style={s.ghostText}>← Retour</Text>
            </Pressable>
            <Pressable
              style={[s.primaryBtn, (!password || loading) && s.disabled]}
              disabled={!password || loading}
              onPress={activateFullE2E}
            >
              <Text style={s.primaryText}>
                {loading ? "Activation…" : "Activer"}
              </Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* Voir seed — mot de passe */}
      {view === "view-seed-pw" && (
        <View style={s.card}>
          <Text style={s.title}>🔐 Voir ma phrase</Text>
          <Text style={s.desc}>
            Entre ton mot de passe pour déchiffrer tes 12 mots.
          </Text>
          <TextInput
            style={s.input}
            placeholder="Mot de passe"
            placeholderTextColor="#9ca3af"
            secureTextEntry
            value={password}
            onChangeText={(t) => {
              setPassword(t);
              setError("");
            }}
            autoCapitalize="none"
          />
          <Err />
          <View style={s.navRow}>
            <Pressable
              style={s.ghostBtn}
              onPress={() => {
                resetFlow();
                go("overview");
              }}
            >
              <Text style={s.ghostText}>Annuler</Text>
            </Pressable>
            <Pressable
              style={[s.primaryBtn, (!password || loading) && s.disabled]}
              disabled={!password || loading}
              onPress={viewSeedPhrase}
            >
              <Text style={s.primaryText}>
                {loading ? "…" : "Afficher"}
              </Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* Voir seed — révélation */}
      {view === "view-seed-reveal" && (
        <View style={s.card}>
          <Text style={s.title}>🔐 Ta phrase de récupération</Text>
          <Text style={s.desc}>
            Conserve ces mots en lieu sûr. Ne les partage jamais.
          </Text>
          <SeedGrid phrase={revealedSeed} />
          <View style={s.warnBox}>
            <Text style={s.warnText}>
              🔒 Ferme cette vue dès que tu as noté tes mots.
            </Text>
          </View>
          <Pressable
            style={s.secondaryBtn}
            onPress={() => {
              setRevealedSeed("");
              go("overview");
            }}
          >
            <Text style={s.secondaryText}>Fermer</Text>
          </Pressable>
        </View>
      )}

      {/* Restore — recovery depuis la phrase */}
      {view === "restore" && (
        <View style={s.card}>
          <Text style={s.title}>Restaurer mes clés</Text>
          <Text style={s.desc}>
            Entre ta phrase de 12 mots pour re-générer ta clé sur cet appareil
            (utile sur un nouveau téléphone).
          </Text>
          <TextInput
            style={s.textarea}
            placeholder="mot1 mot2 … mot12"
            placeholderTextColor="#9ca3af"
            value={seedInput}
            onChangeText={(t) => {
              setSeedInput(t);
              setError("");
            }}
            multiline
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Err />
          <View style={s.navRow}>
            <Pressable
              style={s.ghostBtn}
              onPress={() => {
                resetFlow();
                go("overview");
              }}
            >
              <Text style={s.ghostText}>Annuler</Text>
            </Pressable>
            <Pressable
              style={[s.primaryBtn, (!seedInput.trim() || loading) && s.disabled]}
              disabled={!seedInput.trim() || loading}
              onPress={restoreFromSeed}
            >
              <Text style={s.primaryText}>
                {loading ? "…" : "Restaurer"}
              </Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* Désactivation */}
      {view === "deactivate" && (
        <View style={s.card}>
          <Text style={s.title}>⚠️ Désactiver le Chiffrement Maximum ?</Text>
          <View style={s.warnBox}>
            <Text style={s.warnText}>
              Tu perdras l'accès aux messages échangés pendant la période de
              chiffrement maximum. Tes messages antérieurs resteront lisibles. Un
              nouveau jeu de clés standard sera généré. Action irréversible.
            </Text>
          </View>
          <TextInput
            style={s.input}
            placeholder="Mot de passe"
            placeholderTextColor="#9ca3af"
            secureTextEntry
            value={password}
            onChangeText={(t) => {
              setPassword(t);
              setError("");
            }}
            autoCapitalize="none"
          />
          <Err />
          <View style={s.navRow}>
            <Pressable
              style={s.ghostBtn}
              onPress={() => {
                resetFlow();
                go("overview");
              }}
            >
              <Text style={s.ghostText}>Annuler</Text>
            </Pressable>
            <Pressable
              style={[s.dangerBtn, (!password || loading) && s.disabled]}
              disabled={!password || loading}
              onPress={deactivate}
            >
              <Text style={s.dangerText}>
                {loading ? "Désactivation…" : "Confirmer"}
              </Text>
            </Pressable>
          </View>
        </View>
      )}

      {loading && view === "overview" && (
        <ActivityIndicator color="#3b82f6" style={{ marginTop: 12 }} />
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  content: { padding: 16 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    gap: 12,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  title: { fontSize: 18, fontWeight: "800", color: "#111827" },
  desc: { color: "#4b5563", fontSize: 14, lineHeight: 20 },
  meta: { color: "#6b7280", fontSize: 12 },
  infoBanner: {
    backgroundColor: "#d1fae5",
    color: "#065f46",
    fontWeight: "600",
    padding: 10,
    borderRadius: 10,
    marginBottom: 12,
    textAlign: "center",
  },
  infoBox: {
    backgroundColor: "#eff6ff",
    borderRadius: 10,
    padding: 12,
    gap: 6,
  },
  infoLine: { color: "#1e3a8a", fontSize: 13, lineHeight: 18 },
  warnBox: {
    backgroundColor: "#fef3c7",
    borderRadius: 10,
    padding: 12,
  },
  warnText: { color: "#92400e", fontSize: 13, lineHeight: 18 },
  activeBadge: {
    backgroundColor: "#dcfce7",
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  activeBadgeText: { color: "#166534", fontWeight: "800", fontSize: 15 },
  primaryBtn: {
    flex: 1,
    backgroundColor: "#3b82f6",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  primaryText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: "#3b82f6",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  secondaryText: { color: "#3b82f6", fontWeight: "700", fontSize: 14 },
  dangerBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#fca5a5",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  dangerText: { color: "#dc2626", fontWeight: "700", fontSize: 14 },
  ghostBtn: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  ghostText: { color: "#6b7280", fontWeight: "600" },
  navRow: { flexDirection: "row", gap: 10 },
  disabled: { opacity: 0.5 },
  error: { color: "#b91c1c", fontSize: 13 },
  input: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    color: "#111827",
  },
  textarea: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    color: "#111827",
    minHeight: 80,
    textAlignVertical: "top",
  },
  stepper: {
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    marginBottom: 4,
  },
  step: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#e5e7eb",
    alignItems: "center",
    justifyContent: "center",
  },
  stepDone: { backgroundColor: "#10b981" },
  stepActive: { backgroundColor: "#3b82f6" },
  stepText: { color: "#6b7280", fontWeight: "700" },
  stepTextOn: { color: "#fff" },
  seedGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  seedWord: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#f3f4f6",
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    width: "47%",
  },
  seedNum: { color: "#9ca3af", fontSize: 12, fontWeight: "700", width: 18 },
  seedText: { color: "#111827", fontSize: 14, fontWeight: "600" },
});
