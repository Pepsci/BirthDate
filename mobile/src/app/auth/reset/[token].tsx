import { useState } from "react";
import {
  Text,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { Stack, useRouter, useLocalSearchParams } from "expo-router";
import { api } from "../../../lib/api";
import { useKeyboardPadding } from "../../../lib/use-keyboard-padding";
import { useTheme, useThemedStyles, ThemeColors } from "../../../lib/theme-context";
import PasswordField from "../../../components/PasswordField";

// Doit refléter validatePassword côté serveur (routes/auth.js)
const PASSWORD_RE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

export default function ResetPasswordScreen() {
  const router = useRouter();
  const { token } = useLocalSearchParams<{ token: string }>();
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const keyboardPadding = useKeyboardPadding();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setError(null);
    if (!PASSWORD_RE.test(password)) {
      setError(
        "8 caractères minimum, avec au moins une majuscule, une minuscule et un chiffre.",
      );
      return;
    }
    if (password !== confirm) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }
    setLoading(true);
    try {
      await api(`/auth/reset/${token}`, {
        method: "POST",
        body: JSON.stringify({ password }),
      });
      setDone(true);
    } catch (e: any) {
      setError(
        e?.message ??
          "Une erreur s'est produite. Le lien a peut-être expiré, redemandez-en un.",
      );
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { paddingBottom: keyboardPadding }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Stack.Screen options={{ title: "Nouveau mot de passe" }} />
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        {done ? (
          <>
            <Text style={styles.title}>✅ Mot de passe modifié</Text>
            <Text style={styles.sub}>
              Tu peux maintenant te connecter avec ton nouveau mot de passe.
            </Text>
            <Pressable
              style={styles.button}
              onPress={() => router.replace("/login")}
            >
              <Text style={styles.buttonText}>Se connecter</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text style={styles.title}>Nouveau mot de passe 🔑</Text>
            <Text style={styles.sub}>Choisis un nouveau mot de passe.</Text>

            <PasswordField
              placeholder="Nouveau mot de passe"
              autoComplete="new-password"
              value={password}
              onChangeText={setPassword}
            />

            <PasswordField
              placeholder="Confirme le mot de passe"
              autoComplete="new-password"
              value={confirm}
              onChangeText={setConfirm}
            />

            {error && <Text style={styles.error}>{error}</Text>}

            <Pressable
              style={[
                styles.button,
                (loading || !password || !confirm) && { opacity: 0.6 },
              ]}
              onPress={submit}
              disabled={loading || !password || !confirm}
            >
              {loading ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.buttonText}>Valider</Text>
              )}
            </Pressable>

            {/* Le sort des anciens messages dépend du mode E2E : en standard
                la clé privée est chiffrée avec le mot de passe et devient
                irrécupérable, alors qu'en mode maximum elle se redérive de la
                phrase de 12 mots. L'ancien texte alarmait à tort les
                utilisateurs les mieux protégés. */}
            <Text style={styles.warn}>
              ⚠️ Réinitialiser ton mot de passe régénère ta clé de chiffrement :
              les anciens messages chiffrés deviendront illisibles.
            </Text>
            <Text style={styles.warnSoft}>
              Sauf si tu as activé le chiffrement maximum : ressaisis ta phrase
              de récupération de 12 mots depuis Profil → Chiffrement, et tes
              anciens messages redeviendront lisibles.
            </Text>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    flex: { flex: 1, backgroundColor: c.bg },
    container: { flexGrow: 1, justifyContent: "center", padding: 24, gap: 12 },
    title: {
      fontSize: 22,
      fontWeight: "700",
      textAlign: "center",
      color: c.primary,
    },
    sub: { color: c.sub, textAlign: "center", lineHeight: 22 },
    error: { color: c.danger, textAlign: "center" },
    button: {
      backgroundColor: c.primary,
      borderRadius: 10,
      padding: 15,
      alignItems: "center",
      marginTop: 8,
    },
    buttonText: { color: c.white, fontSize: 16, fontWeight: "600" },
    warn: { color: c.warning, fontSize: 12, textAlign: "center", marginTop: 10 },
    warnSoft: {
      color: c.sub,
      fontSize: 12,
      textAlign: "center",
      marginTop: 6,
      lineHeight: 17,
    },
  });
