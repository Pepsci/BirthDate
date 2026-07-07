import { useState } from "react";
import {
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Stack, useRouter } from "expo-router";
import { api } from "../lib/api";
import { formatBirthday } from "../lib/dates";
import { useKeyboardPadding } from "../lib/use-keyboard-padding";

export default function SignupScreen() {
  const router = useRouter();
  const keyboardPadding = useKeyboardPadding();
  const [name, setName] = useState("");
  const [surname, setSurname] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [birth, setBirth] = useState<Date | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!name.trim() || !surname.trim() || !email.trim() || !password) {
      setError("Tous les champs sont obligatoires.");
      return;
    }
    if (!birth) {
      setError("La date de naissance est obligatoire.");
      return;
    }
    if (password !== confirm) {
      setError("Les deux mots de passe ne correspondent pas.");
      return;
    }
    if (!/(?=.*\d)(?=.*[a-z])(?=.*[A-Z]).{6,}/.test(password)) {
      setError(
        "6 caractères minimum, avec au moins une majuscule, une minuscule et un chiffre.",
      );
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await api("/auth/signup", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          surname: surname.trim(),
          email: email.trim().toLowerCase(),
          password,
          // ISO à midi UTC pour éviter tout glissement de jour lié aux timezones
          birthDate: new Date(
            Date.UTC(
              birth.getFullYear(),
              birth.getMonth(),
              birth.getDate(),
              12,
            ),
          ).toISOString(),
        }),
      });
      setDone(true);
    } catch (e: any) {
      setError(e?.message ?? "Erreur lors de l'inscription.");
      setLoading(false);
    }
  };

  if (done) {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <Stack.Screen options={{ title: "Inscription" }} />
        <Text style={styles.title}>📬 Vérifie tes emails !</Text>
        <Text style={styles.doneText}>
          Un email de vérification a été envoyé à {email.trim()}. Clique sur le
          lien qu'il contient, puis reviens te connecter ici.
        </Text>
        <Pressable style={styles.button} onPress={() => router.back()}>
          <Text style={styles.buttonText}>Retour à la connexion</Text>
        </Pressable>
      </ScrollView>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { paddingBottom: keyboardPadding }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Stack.Screen options={{ title: "Créer un compte" }} />
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Bienvenue ! 🎂</Text>

        <TextInput placeholderTextColor="#9ca3af" style={styles.input}
          placeholder="Prénom *" value={name} onChangeText={setName} />
        <TextInput placeholderTextColor="#9ca3af" style={styles.input}
          placeholder="Nom *" value={surname} onChangeText={setSurname} />
        <TextInput placeholderTextColor="#9ca3af" style={styles.input}
          placeholder="Email *" autoCapitalize="none" keyboardType="email-address"
          value={email} onChangeText={setEmail} />
        <TextInput placeholderTextColor="#9ca3af" style={styles.input}
          placeholder="Mot de passe *" secureTextEntry
          value={password} onChangeText={setPassword} />
        <TextInput placeholderTextColor="#9ca3af" style={styles.input}
          placeholder="Confirmer le mot de passe *" secureTextEntry
          value={confirm} onChangeText={setConfirm} />

        <Pressable style={styles.input} onPress={() => setShowPicker(true)}>
          <Text style={birth ? styles.dateText : styles.datePlaceholder}>
            {birth
              ? `${formatBirthday(birth.toISOString())} ${birth.getFullYear()}`
              : "Date de naissance *"}
          </Text>
        </Pressable>
        {showPicker && (
          <DateTimePicker
            value={birth ?? new Date(2000, 0, 1)}
            mode="date"
            display={Platform.OS === "ios" ? "spinner" : "default"}
            maximumDate={new Date()}
            onChange={(event, selected) => {
              if (Platform.OS === "android") setShowPicker(false);
              if (selected) setBirth(selected);
            }}
          />
        )}

        <Text style={styles.hint}>
          6 caractères min., une majuscule, une minuscule et un chiffre.
        </Text>

        {error && <Text style={styles.error}>{error}</Text>}

        <Pressable
          style={[styles.button, loading && { opacity: 0.6 }]}
          onPress={submit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Créer mon compte</Text>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: "#f9fafb" },
  container: { flexGrow: 1, justifyContent: "center", padding: 24, gap: 10 },
  title: {
    fontSize: 24,
    fontWeight: "700",
    textAlign: "center",
    color: "#208AEF",
    marginBottom: 8,
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
  dateText: { fontSize: 16, color: "#111827" },
  datePlaceholder: { fontSize: 16, color: "#9ca3af" },
  hint: { color: "#9ca3af", fontSize: 12, textAlign: "center" },
  error: { color: "#d33", textAlign: "center" },
  button: {
    backgroundColor: "#208AEF",
    borderRadius: 10,
    padding: 15,
    alignItems: "center",
    marginTop: 8,
  },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  doneText: { color: "#374151", textAlign: "center", lineHeight: 22 },
});
