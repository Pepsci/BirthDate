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
  View,
  Linking,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Stack, useRouter } from "expo-router";
import { api } from "../lib/api";
import { formatBirthday } from "../lib/dates";
import { useKeyboardPadding } from "../lib/use-keyboard-padding";
import {
  useTheme,
  useThemedStyles,
  ThemeColors,
} from "../lib/theme-context";

// RGPD France : 15 ans minimum pour s'inscrire (aligné avec le contrôle serveur
// dans server/routes/auth.js et les questionnaires d'âge des stores).
const MIN_AGE = 15;
const maxBirthDate = new Date();
maxBirthDate.setFullYear(maxBirthDate.getFullYear() - MIN_AGE);

export default function SignupScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
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
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const submit = async () => {
    if (!name.trim() || !surname.trim() || !email.trim() || !password) {
      setError("Tous les champs sont obligatoires.");
      return;
    }
    if (!birth) {
      setError("La date de naissance est obligatoire.");
      return;
    }
    if (birth > maxBirthDate) {
      setError(
        `Tu dois avoir au moins ${MIN_AGE} ans pour créer un compte BirthReminder.`,
      );
      return;
    }
    if (password !== confirm) {
      setError("Les deux mots de passe ne correspondent pas.");
      return;
    }
    if (!/(?=.*\d)(?=.*[a-z])(?=.*[A-Z]).{8,}/.test(password)) {
      setError(
        "8 caractères minimum, avec au moins une majuscule, une minuscule et un chiffre.",
      );
      return;
    }
    if (!acceptedTerms) {
      setError("Tu dois accepter les conditions d'utilisation.");
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
          acceptedTerms: true,
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

        <TextInput placeholderTextColor={colors.placeholder} style={styles.input}
          placeholder="Prénom *" value={name} onChangeText={setName} />
        <TextInput placeholderTextColor={colors.placeholder} style={styles.input}
          placeholder="Nom *" value={surname} onChangeText={setSurname} />
        <TextInput placeholderTextColor={colors.placeholder} style={styles.input}
          placeholder="Email *" autoCapitalize="none" keyboardType="email-address"
          value={email} onChangeText={setEmail} />
        <TextInput placeholderTextColor={colors.placeholder} style={styles.input}
          placeholder="Mot de passe *" secureTextEntry
          value={password} onChangeText={setPassword} />
        <TextInput placeholderTextColor={colors.placeholder} style={styles.input}
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
            locale="fr-FR"
            maximumDate={maxBirthDate}
            onChange={(event, selected) => {
              if (Platform.OS === "android") setShowPicker(false);
              if (selected) setBirth(selected);
            }}
          />
        )}

        <Text style={styles.hint}>
          8 caractères min., une majuscule, une minuscule et un chiffre.
        </Text>

        <Pressable
          style={styles.termsRow}
          onPress={() => setAcceptedTerms((v) => !v)}
        >
          <View style={[styles.checkbox, acceptedTerms && styles.checkboxOn]}>
            {acceptedTerms && <Text style={styles.checkmark}>✓</Text>}
          </View>
          <Text style={styles.termsText}>
            J'accepte les{" "}
            <Text
              style={styles.termsLink}
              onPress={() => Linking.openURL("https://birthreminder.com/cgu")}
            >
              conditions d'utilisation
            </Text>
            , dont la tolérance zéro envers les contenus abusifs. *
          </Text>
        </Pressable>

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

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    flex: { flex: 1, backgroundColor: c.bg },
    container: { flexGrow: 1, justifyContent: "center", padding: 24, gap: 10 },
    title: {
      fontSize: 24,
      fontWeight: "700",
      textAlign: "center",
      color: c.primary,
      marginBottom: 8,
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
    dateText: { fontSize: 16, color: c.text },
    datePlaceholder: { fontSize: 16, color: c.placeholder },
    hint: { color: c.faint, fontSize: 12, textAlign: "center" },
    error: { color: c.danger, textAlign: "center" },
    button: {
      backgroundColor: c.primary,
      borderRadius: 10,
      padding: 15,
      alignItems: "center",
      marginTop: 8,
    },
    buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
    doneText: { color: c.sub, textAlign: "center", lineHeight: 22 },
    termsRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 10,
      marginTop: 4,
    },
    checkbox: {
      width: 22,
      height: 22,
      borderRadius: 6,
      borderWidth: 1.5,
      borderColor: c.inputBorder,
      backgroundColor: c.inputBg,
      justifyContent: "center",
      alignItems: "center",
      marginTop: 1,
    },
    checkboxOn: { backgroundColor: c.primary, borderColor: c.primary },
    checkmark: { color: "#fff", fontSize: 14, fontWeight: "700" },
    termsText: { flex: 1, color: c.sub, fontSize: 13, lineHeight: 18 },
    termsLink: { color: c.primary, textDecorationLine: "underline" },
  });
