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
import {
  useTheme,
  useThemedStyles,
  ThemeColors,
} from "../lib/theme-context";

export default function LoginScreen() {
  const { signIn } = useAuth();
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
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
      await signIn(email.trim().toLowerCase(), password);
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
          placeholderTextColor={colors.placeholder}
          style={styles.input}
          placeholder="Email"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          keyboardType="email-address"
          value={email}
          onChangeText={(t) => setEmail(t.toLowerCase())}
        />
        <TextInput
          placeholderTextColor={colors.placeholder}
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
            <ActivityIndicator color={colors.white} />
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

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    flex: { flex: 1, backgroundColor: c.bg },
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
      color: c.primary,
    },
    subtitle: {
      fontSize: 18,
      textAlign: "center",
      marginBottom: 16,
      color: c.sub,
    },
    input: {
      borderWidth: 1,
      borderColor: c.inputBorder,
      borderRadius: 10,
      padding: 14,
      fontSize: 16,
      backgroundColor: c.inputBg,
      color: c.text,
    },
    error: { color: c.danger, textAlign: "center" },
    button: {
      backgroundColor: c.primary,
      borderRadius: 10,
      padding: 15,
      alignItems: "center",
      marginTop: 8,
    },
    buttonText: { color: c.white, fontSize: 16, fontWeight: "600" },
    link: { color: c.primary, textAlign: "center", marginTop: 10, fontSize: 14 },
    divider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: c.border,
      marginVertical: 14,
    },
    secondaryBtn: {
      borderWidth: 1,
      borderColor: c.primary,
      borderRadius: 10,
      padding: 13,
      alignItems: "center",
    },
    secondaryText: { color: c.primary, fontWeight: "600", fontSize: 15 },
  });
