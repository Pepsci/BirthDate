import { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  Image,
  Platform,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Stack, useRouter } from "expo-router";
import DateTimePicker from "@react-native-community/datetimepicker";
import * as ImagePicker from "expo-image-picker";
import { useAuth } from "../../lib/auth-context";
import {
  UserProfile,
  fetchMe,
  updateMe,
  updateAvatar,
  removeAvatar,
} from "../../lib/users";
import { formatBirthday } from "../../lib/dates";
import {
  useTheme,
  useThemedStyles,
  ThemeColors,
} from "../../lib/theme-context";

export default function ProfileEditScreen() {
  const router = useRouter();
  const { refresh } = useAuth();
  const styles = useThemedStyles(makeStyles);
  const { colors, resolved } = useTheme();
  const [me, setMe] = useState<UserProfile | null>(null);
  const [name, setName] = useState("");
  const [surname, setSurname] = useState("");
  const [email, setEmail] = useState("");
  const [nameday, setNameday] = useState("");
  const [birthDate, setBirthDate] = useState<Date | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  useEffect(() => {
    fetchMe()
      .then((u) => {
        setMe(u);
        setName(u.name ?? "");
        setSurname(u.surname ?? "");
        setEmail(u.email ?? "");
        setNameday(u.nameday ?? "");
        setBirthDate(u.birthDate ? new Date(u.birthDate) : null);
      })
      .catch((e) => setError(e?.message ?? "Erreur de chargement."));
  }, []);

  const pickAvatar = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (result.canceled || !result.assets[0]) return;
    setUploadingAvatar(true);
    setError(null);
    try {
      const updated = await updateAvatar(result.assets[0].uri);
      setMe(updated);
      await refresh();
    } catch (e: any) {
      setError(e?.message ?? "Erreur lors de l'upload de l'avatar.");
    } finally {
      setUploadingAvatar(false);
    }
  };

  // Photo "réelle" = ni l'avatar DiceBear par défaut, ni l'ancien placeholder.
  const hasCustomPhoto =
    !!me?.avatar &&
    !me.avatar.includes("dicebear.com") &&
    !me.avatar.includes("No_image_available");

  const confirmRemoveAvatar = () => {
    Alert.alert(
      "Supprimer la photo",
      "Votre photo sera remplacée par un avatar par défaut.",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Supprimer",
          style: "destructive",
          onPress: async () => {
            setUploadingAvatar(true);
            setError(null);
            try {
              const updated = await removeAvatar();
              setMe(updated);
              await refresh();
            } catch (e: any) {
              setError(e?.message ?? "Erreur lors de la suppression.");
            } finally {
              setUploadingAvatar(false);
            }
          },
        },
      ],
    );
  };

  const save = async () => {
    if (!name.trim() || !email.trim()) {
      setError("Prénom et email sont obligatoires.");
      return;
    }
    if (nameday && !/^\d{2}-\d{2}$/.test(nameday)) {
      setError("La fête doit être au format MM-JJ (ex : 03-13).");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await updateMe({
        name: name.trim(),
        surname: surname.trim(),
        email: email.trim(),
        nameday: nameday || null,
        ...(birthDate
          ? {
              birthDate: new Date(
                Date.UTC(
                  birthDate.getFullYear(),
                  birthDate.getMonth(),
                  birthDate.getDate(),
                  12,
                ),
              ).toISOString(),
            }
          : {}),
      });
      await refresh();
      router.back();
    } catch (e: any) {
      setError(e?.message ?? "Erreur lors de l'enregistrement.");
      setSaving(false);
    }
  };

  if (!me) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title: "Mes informations" }} />
        {error ? (
          <Text style={styles.error}>{error}</Text>
        ) : (
          <ActivityIndicator size="large" color={colors.primary} />
        )}
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      automaticallyAdjustKeyboardInsets
    >
      <Stack.Screen options={{ title: "Mes informations" }} />

      <Pressable style={styles.avatarWrap} onPress={pickAvatar}>
        {me.avatar ? (
          <Image source={{ uri: me.avatar }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarFallback}>
            <Text style={styles.initials}>
              {name[0]?.toUpperCase()}
              {surname[0]?.toUpperCase() ?? ""}
            </Text>
          </View>
        )}
        <Text style={styles.avatarHint}>
          {uploadingAvatar ? "Envoi en cours…" : "Changer la photo"}
        </Text>
      </Pressable>

      {hasCustomPhoto && !uploadingAvatar && (
        <Pressable
          onPress={confirmRemoveAvatar}
          style={styles.removeAvatarBtn}
          hitSlop={8}
        >
          <Text style={styles.removeAvatarText}>Supprimer la photo</Text>
        </Pressable>
      )}

      <Text style={styles.label}>Prénom *</Text>
      <TextInput placeholderTextColor={colors.placeholder} style={styles.input} value={name} onChangeText={setName} />

      <Text style={styles.label}>Nom</Text>
      <TextInput placeholderTextColor={colors.placeholder} style={styles.input} value={surname} onChangeText={setSurname} />

      <Text style={styles.label}>Email *</Text>
      <TextInput placeholderTextColor={colors.placeholder}
        style={styles.input}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />

      <Text style={styles.label}>Date de naissance</Text>
      <Pressable style={styles.input} onPress={() => setShowPicker(true)}>
        <Text style={styles.inputText}>
          {birthDate
            ? `${formatBirthday(birthDate.toISOString())} ${birthDate.getFullYear()}`
            : "Non renseignée — appuyer pour choisir"}
        </Text>
      </Pressable>
      {showPicker && (
        <DateTimePicker
          value={birthDate ?? new Date(2000, 0, 1)}
          mode="date"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          locale="fr-FR"
          maximumDate={new Date()}
          themeVariant={resolved}
          onChange={(event, selected) => {
            if (Platform.OS === "android") setShowPicker(false);
            if (selected) setBirthDate(selected);
          }}
        />
      )}

      <Text style={styles.label}>Ma fête (format MM-JJ)</Text>
      <TextInput placeholderTextColor={colors.placeholder}
        style={styles.input}
        value={nameday}
        onChangeText={setNameday}
        placeholder="ex : 03-13"
        autoCapitalize="none"
        maxLength={5}
      />

      {error && <Text style={styles.error}>{error}</Text>}

      <Pressable
        style={[styles.submit, saving && { opacity: 0.6 }]}
        onPress={save}
        disabled={saving}
      >
        {saving ? (
          <ActivityIndicator color={colors.white} />
        ) : (
          <Text style={styles.submitText}>Enregistrer</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    content: { padding: 16, gap: 6, paddingBottom: 48 },
    center: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: c.bg,
    },
    avatarWrap: { alignItems: "center", gap: 4, marginBottom: 8 },
    avatar: { width: 88, height: 88, borderRadius: 44 },
    avatarFallback: {
      width: 88,
      height: 88,
      borderRadius: 44,
      backgroundColor: c.primarySoft,
      justifyContent: "center",
      alignItems: "center",
    },
    initials: { fontSize: 30, fontWeight: "700", color: c.primaryStrong },
    avatarHint: { color: c.primary, fontSize: 13, fontWeight: "600" },
    removeAvatarBtn: { alignSelf: "center", paddingVertical: 4, marginBottom: 8 },
    removeAvatarText: { color: c.danger, fontSize: 13, fontWeight: "600" },
    label: { fontSize: 13, fontWeight: "700", color: c.sub, marginTop: 10 },
    input: {
      borderWidth: 1,
      borderColor: c.inputBorder,
      borderRadius: 10,
      padding: 12,
      fontSize: 16,
      backgroundColor: c.inputBg,
      color: c.text,
    },
    inputText: { fontSize: 16, color: c.text },
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
