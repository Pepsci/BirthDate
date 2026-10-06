import { t } from "@/i18n";
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
import { router } from "expo-router";
import { useAuth } from "../../lib/auth-context";
import { useTheme, useThemedStyles } from "../../lib/theme-context";
import PasswordField from "../PasswordField";
import { makeAuthStyles, PanelName } from "./authStyles";
import { LOCAL_MODE_READY } from "../../lib/app-mode";

/**
 * Panneau « Connexion » du pager /login.
 * La logique d'authentification est inchangée : signIn(email, password).
 */
export default function LoginPanel({
  onGoTo,
}: {
  onGoTo: (panel: PanelName) => void;
}) {
  const { signIn, mode, enterLocalMode } = useAuth();
  const { colors } = useTheme();
  const s = useThemedStyles(makeAuthStyles);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    if (!email || !password) {
      setError(t("auth:login.required"));
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await signIn(email.trim().toLowerCase(), password);
    } catch (e: any) {
      setError(e?.message ?? t("auth:login.error"));
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
      <Text style={s.title}>{t("auth:login.title")}</Text>
      <Text style={s.subtitle}>{t("auth:login.subtitle")}</Text>

      <TextInput
        placeholderTextColor={colors.placeholder}
        style={s.input}
        placeholder={t("auth:email")}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        keyboardType="email-address"
        value={email}
        onChangeText={(t) => setEmail(t.toLowerCase())}
      />
      <PasswordField
        placeholder={t("auth:password")}
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
          <Text style={s.buttonText}>{t("auth:login.submit")}</Text>
        )}
      </Pressable>

      <Pressable onPress={() => onGoTo("forgot")}>
        <Text style={s.link}>{t("auth:login.forgot")}</Text>
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
          {t("auth:login.create")}
        </Text>
      </Pressable>

      {/* Point d'entrée discret vers le mode local (MODE_LOCAL.md § 3.1 bis).
          Masqué si on y est déjà : on vient alors du profil pour se connecter. */}
      {LOCAL_MODE_READY && mode !== "local" && (
        <Pressable
          onPress={async () => {
            await enterLocalMode();
            router.replace("/");
          }}
        >
          <Text style={s.link}>{t("auth:continueWithout")}</Text>
        </Pressable>
      )}
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
