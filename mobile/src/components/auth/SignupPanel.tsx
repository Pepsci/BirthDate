import { t, getLocaleTag, getLanguage } from "@/i18n";
import { useEffect, useState } from "react";
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
import { api, APP_VERSION } from "../../lib/api";
import { useAuth } from "../../lib/auth-context";
import { LOCAL_MODE_READY, withServerAccess } from "../../lib/app-mode";
import { formatBirthday } from "../../lib/dates";
import { legalUrl } from "../../lib/legal";
import { useTheme, useThemedStyles } from "../../lib/theme-context";
import PasswordField from "../PasswordField";
import { makeAuthStyles, PanelName } from "./authStyles";

// Âge minimum pour s'inscrire : 15 ans, ou 16 selon le pays. C'est le serveur
// qui décide (server/utils/minAge.js) ; 15 n'est que la valeur affichée en
// attendant sa réponse. Le contrôle qui fait foi reste celui de l'inscription.
const DEFAULT_MIN_AGE = 15;

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
  const [minAge, setMinAge] = useState<number | null>(null);
  const MIN_AGE = minAge ?? DEFAULT_MIN_AGE;
  const maxBirthDate = new Date();
  maxBirthDate.setFullYear(maxBirthDate.getFullYear() - MIN_AGE);
  const isUnder15 = !!birth && birth > maxBirthDate;

  // Demandé au serveur seulement une fois la date choisie : tant que la
  // personne n'a rien saisi, aucune requête ne part (important en mode local).
  const hasBirth = !!birth;
  useEffect(() => {
    if (!hasBirth || minAge !== null) return;
    let cancelled = false;
    withServerAccess(() => api<{ minAge: number }>("/auth/min-age"))
      .then((r) => {
        if (!cancelled && typeof r?.minAge === "number") setMinAge(r.minAge);
      })
      // Hors ligne : on garde 15, le serveur tranchera à l'inscription.
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [hasBirth, minAge]);

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
      setError(e?.message ?? t("auth:signup.localError"));
      setLoading(false);
    }
  };

  const submit = async () => {
    if (!name.trim() || !surname.trim() || !email.trim() || !password) {
      setError(t("auth:signup.allRequired"));
      return;
    }
    if (!birth) {
      setError(t("auth:signup.birthRequired"));
      return;
    }
    if (birth > maxBirthDate) {
      setError(
        t("auth:signup.minAge", { age: MIN_AGE }),
      );
      return;
    }
    if (password !== confirm) {
      setError(t("auth:passwordMismatch"));
      return;
    }
    if (!/(?=.*\d)(?=.*[a-z])(?=.*[A-Z]).{8,}/.test(password)) {
      setError(
        t("auth:passwordRule"),
      );
      return;
    }
    if (!acceptedTerms) {
      setError(t("auth:signup.termsRequired"));
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
          // Provenance de l'inscription, affichée dans l'admin (journal).
          platform: Platform.OS,
          appVersion: APP_VERSION,
          language: getLanguage(),
        }),
      }));
      setDone(true);
    } catch (e: any) {
      setError(e?.message ?? t("auth:signup.error"));
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
        <Text style={s.title}>{t("auth:signup.doneTitle")}</Text>
        <Text style={s.doneText}>
          {t("auth:signup.doneText", { email: email.trim() })}
        </Text>
        <Pressable style={s.button} onPress={() => onGoTo("login")}>
          <Text style={s.buttonText}>{t("auth:backToLogin")}</Text>
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
      <Text style={s.title}>{t("auth:signup.title")}</Text>
      <Text style={s.subtitle}>{t("auth:signup.subtitle")}</Text>

      {/* Date de naissance EN PREMIER : elle décide de la suite du formulaire */}
      <Pressable style={s.input} onPress={() => setShowPicker(true)}>
        <Text style={birth ? s.dateText : s.datePlaceholder}>
          {birth
            ? `${formatBirthday(birth.toISOString())} ${birth.getFullYear()}`
            : t("auth:signup.birthDate")}
        </Text>
      </Pressable>
      {showPicker && (
        <View style={s.pickerWrap}>
          <DateTimePicker
            value={birth ?? maxBirthDate}
            mode="date"
            display="spinner"
            locale={getLocaleTag()}
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
              {t("auth:signup.under15Title", { age: MIN_AGE })}
            </Text>
            <Text style={s.localText}>
              {LOCAL_MODE_READY
                ? t("auth:signup.under15Local")
                : t("auth:signup.under15Wait", { age: MIN_AGE })}
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
                <Text style={s.buttonText}>{t("auth:signup.useWithout")}</Text>
              )}
            </Pressable>
          )}
        </>
      ) : (
        <>
          <TextInput
            placeholderTextColor={colors.placeholder}
            style={s.input}
            placeholder={t("auth:signup.firstName")}
            value={name}
            onChangeText={setName}
          />
          <TextInput
            placeholderTextColor={colors.placeholder}
            style={s.input}
            placeholder={t("auth:signup.lastName")}
            value={surname}
            onChangeText={setSurname}
          />
          <TextInput
            placeholderTextColor={colors.placeholder}
            style={s.input}
            placeholder={t("auth:signup.email")}
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
          <PasswordField
            placeholder={t("auth:signup.password")}
            value={password}
            onChangeText={setPassword}
          />
          <PasswordField
            placeholder={t("auth:signup.confirm")}
            value={confirm}
            onChangeText={setConfirm}
          />

          <Text style={s.hint}>
            {t("auth:signup.hint")}
          </Text>

          <Pressable style={s.termsRow} onPress={() => setAcceptedTerms((v) => !v)}>
            <View style={[s.checkbox, acceptedTerms && s.checkboxOn]}>
              {acceptedTerms && <Text style={s.checkmark}>✓</Text>}
            </View>
            <Text style={s.termsText}>
              {t("auth:signup.termsBefore")}{" "}
              <Text
                style={s.termsLink}
                onPress={() => Linking.openURL(legalUrl("cgu"))}
              >
                {t("auth:signup.termsLink")}
              </Text>
              {t("auth:signup.termsAfter")}
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
              <Text style={s.buttonText}>{t("auth:signup.submit")}</Text>
            )}
          </Pressable>
        </>
      )}

      <Pressable onPress={() => onGoTo("login")}>
        <Text style={s.link}>{t("auth:signup.haveAccount")}</Text>
      </Pressable>

      {/* Pour tous : une porte de sortie à qui hésite à confier ses données */}
      {LOCAL_MODE_READY && !isUnder15 && mode !== "local" && (
        <Pressable onPress={startLocal} disabled={loading}>
          <Text style={s.link}>{t("auth:continueWithout")}</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}
