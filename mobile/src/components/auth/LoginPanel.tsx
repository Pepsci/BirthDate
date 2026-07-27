import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  ScrollView,
  StyleSheet,
} from "react-native";
import { useAuth } from "../../lib/auth-context";
import { useTheme, useThemedStyles } from "../../lib/theme-context";
import PasswordField from "../PasswordField";
import { makeAuthStyles, PanelName } from "./authStyles";

/**
 * Panneau « Connexion » du pager /login.
 * La logique d'authentification est inchangée : signIn(email, password).
 */
export default function LoginPanel({
  onGoTo,
}: {
  onGoTo: (panel: PanelName) => void;
}) {
  const { signIn } = useAuth();
  const { colors } = useTheme();
  const s = useThemedStyles(makeAuthStyles);
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
    <ScrollView
      contentContainerStyle={s.page}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <Text style={s.title}>Bon retour 👋</Text>
      <Text style={s.subtitle}>Connecte-toi à ton compte</Text>

      <TextInput
        placeholderTextColor={colors.placeholder}
        style={s.input}
        placeholder="Email"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        keyboardType="email-address"
        value={email}
        onChangeText={(t) => setEmail(t.toLowerCase())}
      />
      <PasswordField
        placeholder="Mot de passe"
        autoComplete="password"
        value={password}
        onChangeText={setPassword}
      />

      {error && <Text style={s.error}>{error}</Text>}

      <Pressable
        style={({ pressed }) => [s.button, pressed && { opacity: 0.7 }]}
        onPress={onSubmit}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color={colors.white} />
        ) : (
          <Text style={s.buttonText}>Se connecter</Text>
        )}
      </Pressable>

      <Pressable onPress={() => onGoTo("forgot")}>
        <Text style={s.link}>Mot de passe oublié ?</Text>
      </Pressable>

      <View style={local.divider} />

      <Pressable
        style={({ pressed }) => [
          local.secondaryBtn,
          { borderColor: colors.primary },
          pressed && { opacity: 0.7 },
        ]}
        onPress={() => onGoTo("signup")}
      >
        <Text style={[local.secondaryText, { color: colors.primary }]}>
          Créer un compte
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const local = StyleSheet.create({
  divider: { height: 6 },
  secondaryBtn: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 13,
    alignItems: "center",
  },
  secondaryText: { fontWeight: "600", fontSize: 15 },
});
