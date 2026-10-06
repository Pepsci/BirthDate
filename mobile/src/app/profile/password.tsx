import { t } from "@/i18n";
import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { Stack, useRouter } from "expo-router";
import { useAuth } from "../../lib/auth-context";
import { updateMe } from "../../lib/users";
import { getPrivateKey, encryptPrivateKey } from "../../lib/crypto";
import {
  useTheme,
  useThemedStyles,
  ThemeColors,
} from "../../lib/theme-context";
import { formPane } from "../../lib/layout";

export default function PasswordScreen() {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // Un seul oeil pour les trois champs : on saisit trois fois de suite, les
  // masquer separement obligerait a trois allers-retours.
  const [visible, setVisible] = useState(false);

  const submit = async () => {
    if (!current || !next || !confirm) {
      setError(t("auth:signup.allRequired"));
      return;
    }
    if (next !== confirm) {
      setError(t("profile:password.mismatch"));
      return;
    }
    if (!/(?=.*\d)(?=.*[a-z])(?=.*[A-Z]).{8,}/.test(next)) {
      setError(
        t("auth:passwordRule"),
      );
      return;
    }
    setError(null);
    setSaving(true);
    try {
      // ⚠️ E2E : la clé privée est chiffrée avec le mot de passe.
      // On la re-chiffre avec le nouveau, sinon elle devient illisible.
      const privateKey = await getPrivateKey();
      const encryptedPrivateKey =
        privateKey && user?._id
          ? encryptPrivateKey(privateKey, next, user._id.toString())
          : undefined;

      await updateMe({
        currentPassword: current,
        newPassword: next,
        ...(encryptedPrivateKey ? { encryptedPrivateKey } : {}),
      });
      router.back();
    } catch (e: any) {
      setError(e?.message ?? t("profile:password.error"));
      setSaving(false);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      automaticallyAdjustKeyboardInsets
    >
      <Stack.Screen options={{ title: t("auth:password") }} />

      <View style={styles.labelRow}>
        <Text style={styles.label}>{t("profile:password.current")}</Text>
        <Pressable onPress={() => setVisible((v) => !v)} hitSlop={10}>
          <Text style={styles.toggle}>
            {visible ? t("common:actions.hide") : t("common:actions.show")}
          </Text>
        </Pressable>
      </View>
      <TextInput placeholderTextColor={colors.placeholder}
        style={styles.input}
        secureTextEntry={!visible}
        autoCapitalize="none"
        autoCorrect={false}
        textContentType="password"
        value={current}
        onChangeText={setCurrent}
      />

      <Text style={styles.label}>{t("auth:reset.screenTitle")}</Text>
      <TextInput placeholderTextColor={colors.placeholder}
        style={styles.input}
        secureTextEntry={!visible}
        autoCapitalize="none"
        autoCorrect={false}
        textContentType="newPassword"
        value={next}
        onChangeText={setNext}
      />

      <Text style={styles.label}>{t("profile:password.confirm")}</Text>
      <TextInput placeholderTextColor={colors.placeholder}
        style={styles.input}
        secureTextEntry={!visible}
        autoCapitalize="none"
        autoCorrect={false}
        textContentType="newPassword"
        value={confirm}
        onChangeText={setConfirm}
      />

      <Text style={styles.hint}>
        {t("profile:password.e2eNote")}
      </Text>

      {error && <Text style={styles.error}>{error}</Text>}

      <Pressable
        style={[styles.submit, saving && { opacity: 0.6 }]}
        onPress={submit}
        disabled={saving}
      >
        {saving ? (
          <ActivityIndicator color={colors.white} />
        ) : (
          <Text style={styles.submitText}>{t("profile:password.submit")}</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg },
  content: { padding: 16, gap: 6, ...formPane },
  label: { fontSize: 13, fontWeight: "700", color: c.sub, marginTop: 10 },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  toggle: { fontSize: 13, fontWeight: "700", color: c.primary, marginTop: 10 },
  input: {
    borderWidth: 1,
    borderColor: c.inputBorder,
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    backgroundColor: c.inputBg,
    color: c.text,
  },
  hint: { color: c.faint, fontSize: 12, marginTop: 10 },
  error: { color: c.danger, textAlign: "center", marginTop: 8 },
  submit: {
    backgroundColor: c.primary,
    borderRadius: 10,
    padding: 14,
    alignItems: "center",
    marginTop: 16,
  },
  submitText: { color: c.white, fontWeight: "600", fontSize: 16 },
});
