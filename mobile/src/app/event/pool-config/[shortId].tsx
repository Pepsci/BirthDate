import { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  Switch,
  Platform,
  ActivityIndicator,
} from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import DateTimePicker from "@react-native-community/datetimepicker";
import * as WebBrowser from "expo-web-browser";
import {
  PoolInfo,
  fetchPool,
  updatePool,
  stripeOnboardingLink,
  stripeStatus,
} from "../../../lib/events";

export default function PoolConfigScreen() {
  const { shortId } = useLocalSearchParams<{ shortId: string }>();
  const router = useRouter();
  const [loaded, setLoaded] = useState(false);
  const [active, setActive] = useState(false);
  const [mode, setMode] = useState<"free" | "goal">("free");
  const [goal, setGoal] = useState("");
  const [deadline, setDeadline] = useState<Date | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stripeNotReady, setStripeNotReady] = useState(false);
  const [onboarding, setOnboarding] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!shortId) return;
    fetchPool(shortId)
      .then((p: PoolInfo) => {
        setActive(p.active);
        setMode(p.mode ?? "free");
        setGoal(p.goal ? String(p.goal / 100) : "");
        setDeadline(p.deadline ? new Date(p.deadline) : null);
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, [shortId]);

  const connectStripe = async () => {
    if (onboarding) return;
    setOnboarding(true);
    setError(null);
    try {
      // Lien d'onboarding hébergé par Stripe, ouvert dans le navigateur intégré
      const url = await stripeOnboardingLink();
      await WebBrowser.openBrowserAsync(url);
      // Au retour : vérifier si le compte est prêt
      const status = await stripeStatus();
      if (status.ready) {
        setStripeNotReady(false);
        setError(null);
      } else {
        setError(
          "Onboarding pas encore terminé — reprends-le quand tu veux avec le même bouton.",
        );
      }
    } catch (e: any) {
      setError(e?.message ?? "Erreur lors de la connexion Stripe.");
    } finally {
      setOnboarding(false);
    }
  };

  const save = async () => {
    if (saving) return;
    setError(null);
    setStripeNotReady(false);
    setSaving(true);
    try {
      await updatePool(shortId!, {
        active,
        mode,
        goal:
          mode === "goal" && goal
            ? Math.round(Number(goal.replace(",", ".")) * 100)
            : null,
        deadline: deadline ? deadline.toISOString() : null,
      });
      router.back();
    } catch (e: any) {
      if (e?.message?.includes("Stripe")) setStripeNotReady(true);
      setError(e?.message ?? "Erreur lors de l'enregistrement.");
      setSaving(false);
    }
  };

  if (!loaded) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title: "Cagnotte" }} />
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: "Configurer la cagnotte" }} />

      <View style={styles.switchRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.switchLabel}>Cagnotte activée</Text>
          <Text style={styles.hint}>
            Les invités pourront contribuer par carte bancaire
          </Text>
        </View>
        <Switch
          value={active}
          onValueChange={setActive}
          trackColor={{ true: "#10b981" }}
        />
      </View>

      {active && (
        <>
          <Text style={styles.label}>Mode</Text>
          <View style={styles.modeSwitch}>
            <Pressable
              style={[styles.modeBtn, mode === "free" && styles.modeBtnActive]}
              onPress={() => setMode("free")}
            >
              <Text
                style={[styles.modeText, mode === "free" && styles.modeTextActive]}
              >
                🆓 Libre
              </Text>
            </Pressable>
            <Pressable
              style={[styles.modeBtn, mode === "goal" && styles.modeBtnActive]}
              onPress={() => setMode("goal")}
            >
              <Text
                style={[styles.modeText, mode === "goal" && styles.modeTextActive]}
              >
                🎯 Objectif
              </Text>
            </Pressable>
          </View>

          {mode === "goal" && (
            <>
              <Text style={styles.label}>Objectif (€)</Text>
              <TextInput
                placeholderTextColor="#9ca3af"
                style={styles.input}
                placeholder="ex : 150"
                keyboardType="decimal-pad"
                value={goal}
                onChangeText={setGoal}
              />
            </>
          )}

          <Text style={styles.label}>Date limite (optionnel)</Text>
          <Pressable style={styles.input} onPress={() => setShowPicker(true)}>
            <Text style={styles.inputText}>
              {deadline
                ? deadline.toLocaleDateString("fr-FR", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })
                : "Aucune — appuyer pour choisir"}
            </Text>
          </Pressable>
          {deadline && (
            <Pressable onPress={() => setDeadline(null)}>
              <Text style={styles.clearDeadline}>Retirer la date limite</Text>
            </Pressable>
          )}
          {showPicker && (
            <DateTimePicker
              value={deadline ?? new Date()}
              mode="date"
              minimumDate={new Date()}
              display={Platform.OS === "ios" ? "spinner" : "default"}
              onChange={(e, d) => {
                if (Platform.OS === "android") setShowPicker(false);
                if (d && e.type !== "dismissed") setDeadline(d);
              }}
            />
          )}
        </>
      )}

      {stripeNotReady && (
        <View style={styles.warn}>
          <Text style={styles.warnText}>
            ⚠️ Pour encaisser la cagnotte, connecte ton compte Stripe (une
            seule fois, environ 5 minutes — identité et RIB demandés par
            Stripe).
          </Text>
          <Pressable
            style={[styles.stripeBtn, onboarding && { opacity: 0.6 }]}
            disabled={onboarding}
            onPress={connectStripe}
          >
            {onboarding ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.stripeBtnText}>
                🔗 Connecter mon compte Stripe
              </Text>
            )}
          </Pressable>
        </View>
      )}
      {error && !stripeNotReady && <Text style={styles.error}>{error}</Text>}

      <Pressable
        style={[styles.saveBtn, saving && { opacity: 0.6 }]}
        disabled={saving}
        onPress={save}
      >
        {saving ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.saveText}>Enregistrer</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  content: { padding: 16, gap: 8 },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f9fafb",
  },
  label: { fontSize: 13, fontWeight: "700", color: "#6b7280", marginTop: 10 },
  hint: { color: "#9ca3af", fontSize: 12 },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
  },
  switchLabel: { fontSize: 15, fontWeight: "600", color: "#111827" },
  modeSwitch: {
    flexDirection: "row",
    backgroundColor: "#f3f4f6",
    borderRadius: 10,
    padding: 3,
  },
  modeBtn: { flex: 1, paddingVertical: 9, borderRadius: 8, alignItems: "center" },
  modeBtnActive: { backgroundColor: "#fff", elevation: 1 },
  modeText: { fontSize: 13, fontWeight: "600", color: "#6b7280" },
  modeTextActive: { color: "#111827" },
  input: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    backgroundColor: "#fff",
    color: "#111827",
  },
  inputText: { fontSize: 15, color: "#111827" },
  clearDeadline: { color: "#ef4444", fontSize: 12, textAlign: "center" },
  warn: { backgroundColor: "#fef3c7", borderRadius: 10, padding: 12 },
  warnText: { color: "#92400e", fontSize: 13, lineHeight: 18 },
  stripeBtn: {
    backgroundColor: "#635bff",
    borderRadius: 10,
    padding: 12,
    alignItems: "center",
    marginTop: 10,
  },
  stripeBtnText: { color: "#fff", fontWeight: "700" },
  error: { color: "#b91c1c", textAlign: "center", marginTop: 8 },
  saveBtn: {
    backgroundColor: "#3b82f6",
    borderRadius: 10,
    padding: 14,
    alignItems: "center",
    marginTop: 12,
  },
  saveText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});
