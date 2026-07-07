import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../lib/auth-context";
import { useKeyboardPadding } from "../lib/use-keyboard-padding";

export default function LoginScreen() {
  const { signIn } = useAuth();
  const router = useRouter();
  const keyboardPadding = useKeyboardPadding();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    if (!email || !password) {
      setError("Email et mot de passe requis.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await signIn(email.trim(), password);
    } catch (e: any) {
      setError(e?.message ?? "Erreur de connexion.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { paddingBottom: keyboardPadding }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>BirthReminder</Text>
        <Text style={styles.subtitle}>Connexion</Text>

        <TextInput
          placeholderTextColor="#9ca3af"
          style={styles.input}
          placeholder="Email"
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        <TextInput
          placeholderTextColor="#9ca3af"
          style={styles.input}
          placeholder="Mot de passe"
          secureTextEntry
          autoComplete="password"
          value={password}
          onChangeText={setPassword}
        />

        {error && <Text style={styles.error}>{error}</Text>}

        <Pressable
          style={({ pressed }) => [styles.button, pressed && { opacity: 0.7 }]}
          onPress={onSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Se connecter</Text>
          )}
        </Pressable>

        <Pressable onPress={() => router.push("/forgot-password")}>
          <Text style={styles.link}>Mot de passe oublié ?</Text>
        </Pressable>

        <View style={styles.divider} />

        <Pressable
          style={styles.secondaryBtn}
          onPress={() => router.push("/signup")}
        >
          <Text style={styles.secondaryText}>Créer un compte</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: "#f9fafb" },
  container: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 24,
    gap: 12,
  },
  title: {
    fontSize: 32,
    fontWeight: "700",
    textAlign: "center",
    color: "#208AEF",
  },
  subtitle: {
    fontSize: 18,
    textAlign: "center",
    marginBottom: 16,
    color: "#666",
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
  link: { color: "#3b82f6", textAlign: "center", marginTop: 10, fontSize: 14 },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#e5e7eb",
    marginVertical: 14,
  },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: "#208AEF",
    borderRadius: 10,
    padding: 13,
    alignItems: "center",
  },
  secondaryText: { color: "#208AEF", fontWeight: "600", fontSize: 15 },
});
