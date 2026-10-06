import { t } from "@/i18n";
import { useState } from "react";
import {
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { api } from "../../lib/api";
import { withServerAccess } from "../../lib/app-mode";
import { useTheme, useThemedStyles } from "../../lib/theme-context";
import { makeAuthStyles, PanelName } from "./authStyles";

/** Panneau « Mot de passe oublié » du pager /login. Logique inchangée. */
export default function ForgotPanel({
  onGoTo,
}: {
  onGoTo: (panel: PanelName) => void;
}) {
  const { colors } = useTheme();
  const s = useThemedStyles(makeAuthStyles);
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!email.trim()) return;
    setError(null);
    setLoading(true);
    try {
      // Possible depuis le mode local (compte existant, mot de passe oublié)
      await withServerAccess(() =>
        api("/auth/forgot-password", {
          method: "POST",
          body: JSON.stringify({ email: email.trim().toLowerCase() }),
        }),
      );
      setDone(true);
    } catch (e: any) {
      setError(e?.message ?? t("auth:forgot.error"));
      setLoading(false);
    }
  };

  return (
    <ScrollView
      contentContainerStyle={s.page}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {done ? (
        <>
          <Text style={s.title}>{t("auth:forgot.doneTitle")}</Text>
          <Text style={s.doneText}>
            {t("auth:forgot.doneText", { email: email.trim() })}
          </Text>
          <Pressable style={s.button} onPress={() => onGoTo("login")}>
            <Text style={s.buttonText}>{t("auth:backToLogin")}</Text>
          </Pressable>
        </>
      ) : (
        <>
          <Text style={s.title}>{t("auth:forgot.title")}</Text>
          <Text style={s.subtitle}>
            {t("auth:forgot.subtitle")}
          </Text>
          <TextInput
            placeholderTextColor={colors.placeholder}
            style={s.input}
            placeholder={t("auth:email")}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
          {error && <Text style={s.error}>{error}</Text>}
          <Pressable
            style={[s.button, (loading || !email.trim()) && { opacity: 0.6 }]}
            onPress={submit}
            disabled={loading || !email.trim()}
          >
            {loading ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={s.buttonText}>{t("auth:forgot.submit")}</Text>
            )}
          </Pressable>
          <Text style={s.warn}>
            {t("auth:reset.warn")}
          </Text>
          <Pressable onPress={() => onGoTo("login")}>
            <Text style={s.link}>← {t("auth:backToLogin")}</Text>
          </Pressable>
        </>
      )}
    </ScrollView>
  );
}
