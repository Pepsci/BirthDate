import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  ScrollView,
  Linking,
  Platform,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { api } from "../../lib/api";
import { formatBirthday } from "../../lib/dates";
import { useTheme, useThemedStyles } from "../../lib/theme-context";
import PasswordField from "../PasswordField";
import { makeAuthStyles, PanelName } from "./authStyles";

// RGPD France : 15 ans minimum pour s'inscrire (aligné avec le contrôle serveur
// dans server/routes/auth.js et les questionnaires d'âge des stores).
const MIN_AGE = 15;
const maxBirthDate = new Date();
maxBirthDate.setFullYear(maxBirthDate.getFullYear() - MIN_AGE);

/** Panneau « Inscription » du pager /login. Logique inchangée. */
export default function SignupPanel({
  onGoTo,
}: {
  onGoTo: (panel: PanelName) => void;
}) {
  const { colors, resolved } = useTheme();
  const s = useThemedStyles(makeAuthStyles);
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
            Date.UTC(birth.getFullYear(), birth.getMonth(), birth.getDate(), 12),
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
      <ScrollView
        contentContainerStyle={s.page}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={s.title}>📬 Vérifie tes emails !</Text>
        <Text style={s.doneText}>
          Un email de vérification a été envoyé à {email.trim()}. Clique sur le
          lien qu'il contient, puis reviens te connecter ici.
        </Text>
        <Pressable style={s.button} onPress={() => onGoTo("login")}>
          <Text style={s.buttonText}>Retour à la connexion</Text>
        </Pressable>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={s.page}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <Text style={s.title}>Bienvenue ! 🎂</Text>
      <Text style={s.subtitle}>Rejoins BirthReminder gratuitement</Text>

      <TextInput
        placeholderTextColor={colors.placeholder}
        style={s.input}
        placeholder="Prénom *"
        value={name}
        onChangeText={setName}
      />
      <TextInput
        placeholderTextColor={colors.placeholder}
        style={s.input}
        placeholder="Nom *"
        value={surname}
        onChangeText={setSurname}
      />
      <TextInput
        placeholderTextColor={colors.placeholder}
        style={s.input}
        placeholder="Email *"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <PasswordField
        placeholder="Mot de passe *"
        value={password}
        onChangeText={setPassword}
      />
      <PasswordField
        placeholder="Confirmer le mot de passe *"
        value={confirm}
        onChangeText={setConfirm}
      />

      <Pressable style={s.input} onPress={() => setShowPicker(true)}>
        <Text style={birth ? s.dateText : s.datePlaceholder}>
          {birth
            ? `${formatBirthday(birth.toISOString())} ${birth.getFullYear()}`
            : "Date de naissance *"}
        </Text>
      </Pressable>
      {showPicker && (
        <View style={s.pickerWrap}>
          <DateTimePicker
            value={birth ?? maxBirthDate}
            mode="date"
            display={Platform.OS === "ios" ? "spinner" : "default"}
            locale="fr-FR"
            maximumDate={maxBirthDate}
            themeVariant={resolved}
            onChange={(event, selected) => {
              if (Platform.OS === "android") setShowPicker(false);
              if (selected) setBirth(selected);
            }}
          />
        </View>
      )}

      <Text style={s.hint}>
        8 caractères min., une majuscule, une minuscule et un chiffre.
      </Text>

      <Pressable style={s.termsRow} onPress={() => setAcceptedTerms((v) => !v)}>
        <View style={[s.checkbox, acceptedTerms && s.checkboxOn]}>
          {acceptedTerms && <Text style={s.checkmark}>✓</Text>}
        </View>
        <Text style={s.termsText}>
          J'accepte les{" "}
          <Text
            style={s.termsLink}
            onPress={() => Linking.openURL("https://birthreminder.com/cgu")}
          >
            conditions d'utilisation
          </Text>
          , dont la tolérance zéro envers les contenus abusifs. *
        </Text>
      </Pressable>

      {error && <Text style={s.error}>{error}</Text>}

      <Pressable
        style={[s.button, loading && { opacity: 0.6 }]}
        onPress={submit}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color={colors.white} />
        ) : (
          <Text style={s.buttonText}>Créer mon compte</Text>
        )}
      </Pressable>

      <Pressable onPress={() => onGoTo("login")}>
        <Text style={s.link}>Déjà un compte ? Se connecter</Text>
      </Pressable>
    </ScrollView>
  );
}
