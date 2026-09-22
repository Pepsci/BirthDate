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
import { router } from "expo-router";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/auth-context";
import { LOCAL_MODE_READY, withServerAccess } from "../../lib/app-mode";
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
  const { enterLocalMode, mode } = useAuth();
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

  // Détecté dès le choix de la date, sans attendre la validation : le reste
  // du formulaire (email, mot de passe…) est alors masqué, on ne fait pas
  // saisir de données personnelles à quelqu'un qui ne pourra pas s'inscrire.
  const isUnder15 = !!birth && birth > maxBirthDate;

  /**
   * « Utiliser sans compte ». Rien n'est envoyé au serveur : les champs déjà
   * saisis restent dans l'état du composant et disparaissent avec lui.
   */
  const startLocal = async () => {
    if (loading) return;
    setLoading(true);
    try {
      await enterLocalMode();
      router.replace("/");
    } catch (e: any) {
      setError(e?.message ?? "Impossible de passer en mode sans compte.");
      setLoading(false);
    }
  };

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
      // withServerAccess : l'inscription reste possible depuis le mode local
      await withServerAccess(() => api("/auth/signup", {
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
      }));
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

      {/* Date de naissance EN PREMIER : elle décide de la suite du formulaire */}
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
            display="spinner"
            locale="fr-FR"
            // Plafond = aujourd'hui (pas de date future), PAS 15 ans : un
            // plafond à 15 ans bloquait la roue sans explication.
            maximumDate={new Date()}
            themeVariant={resolved}
            onChange={(event, selected) => {
              if (Platform.OS === "android") setShowPicker(false);
              if (selected) {
                setBirth(selected);
                setError(null);
              }
            }}
          />
        </View>
      )}

      {isUnder15 ? (
        <>
          <View style={s.localBox}>
            <Text style={s.localTitle}>
              Il faut avoir {MIN_AGE} ans pour créer un compte
            </Text>
            <Text style={s.localText}>
              {LOCAL_MODE_READY
                ? "Mais tu peux utiliser BirthReminder sans compte : tes cartes " +
                  "et tes idées de cadeaux restent sur ton téléphone, rien " +
                  "n'est envoyé. Pas de chat, d'amis ni d'événements."
                : "Tu pourras t'inscrire à partir de tes " + MIN_AGE + " ans."}
            </Text>
          </View>
          {error && <Text style={s.error}>{error}</Text>}
          {LOCAL_MODE_READY && (
            <Pressable
              style={[s.button, loading && s.buttonBusy]}
              onPress={startLocal}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={s.buttonText}>Utiliser sans compte</Text>
              )}
            </Pressable>
          )}
        </>
      ) : (
        <>
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
            style={[s.button, loading && s.buttonBusy]}
            onPress={submit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={s.buttonText}>Créer mon compte</Text>
            )}
          </Pressable>
        </>
      )}

      <Pressable onPress={() => onGoTo("login")}>
        <Text style={s.link}>Déjà un compte ? Se connecter</Text>
      </Pressable>

      {/* Pour tous : une porte de sortie à qui hésite à confier ses données */}
      {LOCAL_MODE_READY && !isUnder15 && mode !== "local" && (
        <Pressable onPress={startLocal} disabled={loading}>
          <Text style={s.link}>Continuer sans compte</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}
