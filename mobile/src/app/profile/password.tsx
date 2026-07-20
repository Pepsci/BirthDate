import { useState } from "react";
import {
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

export default function PasswordScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!current || !next || !confirm) {
      setError("Tous les champs sont obligatoires.");
      return;
    }
    if (next !== confirm) {
      setError("Les deux nouveaux mots de passe ne correspondent pas.");
      return;
    }
    if (!/(?=.*\d)(?=.*[a-z])(?=.*[A-Z]).{8,}/.test(next)) {
      setError(
        "8 caractères minimum, avec au moins une majuscule, une minuscule et un chiffre.",
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
      setError(e?.message ?? "Erreur lors du changement de mot de passe.");
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
      <Stack.Screen options={{ title: "Mot de passe" }} />

      <Text style={styles.label}>Mot de passe actuel</Text>
      <TextInput placeholderTextColor="#9ca3af"
        style={styles.input}
        secureTextEntry
        value={current}
        onChangeText={setCurrent}
      />

      <Text style={styles.label}>Nouveau mot de passe</Text>
      <TextInput placeholderTextColor="#9ca3af"
        style={styles.input}
        secureTextEntry
        value={next}
        onChangeText={setNext}
      />

      <Text style={styles.label}>Confirmer le nouveau mot de passe</Text>
      <TextInput placeholderTextColor="#9ca3af"
        style={styles.input}
        secureTextEntry
        value={confirm}
        onChangeText={setConfirm}
      />

      <Text style={styles.hint}>
        🔐 Ta clé de chiffrement E2E sera automatiquement re-protégée avec le
        nouveau mot de passe.
      </Text>

      {error && <Text style={styles.error}>{error}</Text>}

      <Pressable
        style={[styles.submit, saving && { opacity: 0.6 }]}
        onPress={submit}
        disabled={saving}
      >
        {saving ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.submitText}>Changer le mot de passe</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  content: { padding: 16, gap: 6 },
  label: { fontSize: 13, fontWeight: "700", color: "#6b7280", marginTop: 10 },
  input: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    backgroundColor: "#fff",
    color: "#111827",
  },
  hint: { color: "#9ca3af", fontSize: 12, marginTop: 10 },
  error: { color: "#b91c1c", textAlign: "center", marginTop: 8 },
  submit: {
    backgroundColor: "#3b82f6",
    borderRadius: 10,
    padding: 14,
    alignItems: "center",
    marginTop: 16,
  },
  submitText: { color: "#fff", fontWeight: "600", fontSize: 16 },
});
