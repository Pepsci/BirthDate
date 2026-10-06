import { t } from "@/i18n";
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
        t("auth:passwordRule"),
      );
      return;
    }
    if (password !== confirm) {
      setError(t("auth:passwordMismatch2"));
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
          t("auth:reset.error"),
      );
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { paddingBottom: keyboardPadding }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Stack.Screen options={{ title: t("auth:reset.screenTitle") }} />
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        {done ? (
          <>
            <Text style={styles.title}>{t("auth:reset.doneTitle")}</Text>
            <Text style={styles.sub}>
              {t("auth:reset.doneText")}
            </Text>
            <Pressable
              style={styles.button}
              onPress={() => router.replace("/login")}
            >
              <Text style={styles.buttonText}>{t("auth:login.submit")}</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text style={styles.title}>{t("auth:reset.title")}</Text>
            <Text style={styles.sub}>{t("auth:reset.subtitle")}</Text>

            <PasswordField
              placeholder={t("auth:reset.screenTitle")}
              autoComplete="new-password"
              value={password}
              onChangeText={setPassword}
            />

            <PasswordField
              placeholder={t("auth:reset.confirm")}
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
                <Text style={styles.buttonText}>{t("common:actions.validate")}</Text>
              )}
            </Pressable>

            {/* Le sort des anciens messages dépend du mode E2E : en standard
                la clé privée est chiffrée avec le mot de passe et devient
                irrécupérable, alors qu'en mode maximum elle se redérive de la
                phrase de 12 mots. L'ancien texte alarmait à tort les
                utilisateurs les mieux protégés. */}
            <Text style={styles.warn}>
              {t("auth:reset.warn")}
            </Text>
            <Text style={styles.warnSoft}>
              {t("auth:reset.warnSoft")}
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
