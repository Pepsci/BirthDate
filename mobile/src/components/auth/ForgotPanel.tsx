import { useState } from "react";
import {
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { api } from "../../lib/api";
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
    <ScrollView
      contentContainerStyle={s.page}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {done ? (
        <>
          <Text style={s.title}>📬 Email envoyé !</Text>
          <Text style={s.doneText}>
            Si un compte existe pour {email.trim()}, tu recevras un lien de
            réinitialisation. Suis-le depuis ton téléphone ou ton ordinateur,
            puis reviens te connecter.
          </Text>
          <Pressable style={s.button} onPress={() => onGoTo("login")}>
            <Text style={s.buttonText}>Retour à la connexion</Text>
          </Pressable>
        </>
      ) : (
        <>
          <Text style={s.title}>Mot de passe oublié</Text>
          <Text style={s.subtitle}>
            Entre ton email — on t'envoie un lien de réinitialisation.
          </Text>
          <TextInput
            placeholderTextColor={colors.placeholder}
            style={s.input}
            placeholder="Email"
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
              <Text style={s.buttonText}>Envoyer le lien</Text>
            )}
          </Pressable>
          <Text style={s.warn}>
            ⚠️ Réinitialiser ton mot de passe régénérera ta clé de chiffrement :
            les anciens messages chiffrés deviendront illisibles.
          </Text>
          <Pressable onPress={() => onGoTo("login")}>
            <Text style={s.link}>← Retour à la connexion</Text>
          </Pressable>
        </>
      )}
    </ScrollView>
  );
}
