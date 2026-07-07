import { useState } from "react";
import {
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { Stack, useRouter } from "expo-router";
import { api } from "../lib/api";
import { useKeyboardPadding } from "../lib/use-keyboard-padding";

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const keyboardPadding = useKeyboardPadding();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!email.trim()) return;
    setError(null);
    setLoading(true);
    try {
      await api("/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      setDone(true);
    } catch (e: any) {
      setError(e?.message ?? "Erreur lors de l'envoi.");
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { paddingBottom: keyboardPadding }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Stack.Screen options={{ title: "Mot de passe oublié" }} />
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        {done ? (
          <>
            <Text style={styles.title}>📬 Email envoyé !</Text>
            <Text style={styles.doneText}>
              Si un compte existe pour {email.trim()}, tu recevras un lien de
              réinitialisation. Suis-le depuis ton téléphone ou ton ordinateur,
              puis reviens te connecter.
            </Text>
            <Pressable style={styles.button} onPress={() => router.back()}>
              <Text style={styles.buttonText}>Retour à la connexion</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text style={styles.title}>Mot de passe oublié</Text>
            <Text style={styles.doneText}>
              Entre ton email — on t'envoie un lien de réinitialisation.
            </Text>
            <TextInput placeholderTextColor="#9ca3af"
              style={styles.input}
              placeholder="Email"
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
            />
            {error && <Text style={styles.error}>{error}</Text>}
            <Pressable
              style={[styles.button, (loading || !email.trim()) && { opacity: 0.6 }]}
              onPress={submit}
              disabled={loading || !email.trim()}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Envoyer le lien</Text>
              )}
            </Pressable>
            <Text style={styles.warn}>
              ⚠️ Réinitialiser ton mot de passe régénérera ta clé de chiffrement :
              les anciens messages chiffrés deviendront illisibles.
            </Text>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: "#f9fafb" },
  container: { flexGrow: 1, justifyContent: "center", padding: 24, gap: 12 },
  title: {
    fontSize: 22,
    fontWeight: "700",
    textAlign: "center",
    color: "#208AEF",
  },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    backgroundColor: "#fff",
    color: "#111827",
  },
  error: { color: "#d33", textAlign: "center" },
  button: {
    backgroundColor: "#208AEF",
    borderRadius: 10,
    padding: 15,
    alignItems: "center",
    marginTop: 8,
  },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  doneText: { color: "#374151", textAlign: "center", lineHeight: 22 },
  warn: { color: "#92400e", fontSize: 12, textAlign: "center", marginTop: 10 },
});
