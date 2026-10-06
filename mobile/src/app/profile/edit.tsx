import { getLocaleTag, t } from "@/i18n";
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
import * as ImageManipulator from "expo-image-manipulator";
import { Image as ExpoImage } from "expo-image";
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
import { formPane } from "../../lib/layout";

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
      .catch((e) => setError(e?.message ?? t("common:errors.loading")));
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
      // Les photos iPhone sont en HEIC, que le serveur (sharp sans codec HEVC)
      // ne sait pas décoder. On convertit en JPEG et on réduit à 512px avant
      // l'envoi — même logique que le web avec canvas.
      const jpeg = await ImageManipulator.manipulateAsync(
        result.assets[0].uri,
        [{ resize: { width: 512 } }],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG },
      );
      const updated = await updateAvatar(jpeg.uri);
      setMe(updated);
      await refresh();
    } catch (e: any) {
      setError(e?.message ?? t("profile:edit.avatarError"));
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
      t("profile:edit.removePhoto"),
      t("profile:edit.removePhotoText"),
      [
        { text: t("common:actions.cancel"), style: "cancel" },
        {
          text: t("common:actions.delete"),
          style: "destructive",
          onPress: async () => {
            setUploadingAvatar(true);
            setError(null);
            try {
              const updated = await removeAvatar();
              setMe(updated);
              await refresh();
            } catch (e: any) {
              setError(e?.message ?? t("common:errors.delete"));
            } finally {
              setUploadingAvatar(false);
            }
          },
        },
      ],
    );
  };

  const save = async () => {
    if (!name.trim()) {
      setError(t("date:form.nameRequired"));
      return;
    }
    if (nameday && !/^\d{2}-\d{2}$/.test(nameday)) {
      setError(t("profile:edit.namedayFormat"));
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await updateMe({
        name: name.trim(),
        surname: surname.trim(),
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
      setError(e?.message ?? t("common:errors.save"));
      setSaving(false);
    }
  };

  if (!me) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title: t("profile:menu.info") }} />
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
      <Stack.Screen options={{ title: t("profile:menu.info") }} />

      <View style={styles.avatarWrap}>
        <Pressable onPress={pickAvatar} disabled={uploadingAvatar}>
          {me.avatar ? (
            <ExpoImage
              source={{ uri: me.avatar }}
              style={styles.avatar}
              contentFit="cover"
            />
          ) : (
            <View style={styles.avatarFallback}>
              <Text style={styles.initials}>
                {name[0]?.toUpperCase()}
                {surname[0]?.toUpperCase() ?? ""}
              </Text>
            </View>
          )}
        </Pressable>

        <Pressable
          onPress={pickAvatar}
          style={styles.changePhotoBtn}
          disabled={uploadingAvatar}
        >
          <Text style={styles.changePhotoText}>
            {uploadingAvatar ? t("profile:edit.uploading") : t("date:form.changePhoto")}
          </Text>
        </Pressable>

        {hasCustomPhoto && !uploadingAvatar && (
          <Pressable
            onPress={confirmRemoveAvatar}
            style={styles.removeAvatarBtn}
            hitSlop={8}
          >
            <Text style={styles.removeAvatarText}>{t("profile:edit.removePhoto")}</Text>
          </Pressable>
        )}
      </View>

      <Text style={styles.label}>{t("date:form.firstNameLabel")}</Text>
      <TextInput placeholderTextColor={colors.placeholder} style={styles.input} value={name} onChangeText={setName} />

      <Text style={styles.label}>{t("date:form.lastNameLabel")}</Text>
      <TextInput placeholderTextColor={colors.placeholder} style={styles.input} value={surname} onChangeText={setSurname} />

      {/* L'adresse email identifie le compte : elle ne se modifie pas ici
          (le serveur refuse tout changement, voir routes/users.js). */}
      <Text style={styles.label}>{t("auth:email")}</Text>
      <TextInput
        style={[styles.input, styles.inputLocked]}
        value={email}
        editable={false}
        selectTextOnFocus={false}
      />
      <Text style={styles.hint}>
        {t("profile:edit.emailLocked")}
      </Text>

      <Text style={styles.label}>{t("profile:edit.birthDate")}</Text>
      <Pressable style={styles.input} onPress={() => setShowPicker(true)}>
        <Text style={styles.inputText}>
          {birthDate
            ? `${formatBirthday(birthDate.toISOString())} ${birthDate.getFullYear()}`
            : t("profile:edit.noBirthDate")}
        </Text>
      </Pressable>
      {showPicker && (
        <DateTimePicker
          value={birthDate ?? new Date()}
          mode="date"
          display="spinner"
          locale={getLocaleTag()}
          maximumDate={new Date()}
          themeVariant={resolved}
          onChange={(event, selected) => {
            if (Platform.OS === "android") setShowPicker(false);
            if (selected) setBirthDate(selected);
          }}
        />
      )}

      <Text style={styles.label}>{t("profile:edit.myNameday")}</Text>
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
          <Text style={styles.submitText}>{t("common:actions.save")}</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    content: { padding: 16, gap: 6, paddingBottom: 48, ...formPane },
    center: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: c.bg,
    },
    avatarWrap: { alignItems: "center", gap: 8, marginBottom: 12 },
    avatar: { width: 88, height: 88, borderRadius: 44 },
    changePhotoBtn: {
      paddingVertical: 8,
      paddingHorizontal: 16,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: c.inputBorder,
      backgroundColor: c.inputBg,
    },
    changePhotoText: { color: c.primary, fontSize: 14, fontWeight: "600" },
    avatarFallback: {
      width: 88,
      height: 88,
      borderRadius: 44,
      backgroundColor: c.primarySoft,
      justifyContent: "center",
      alignItems: "center",
    },
    initials: { fontSize: 30, fontWeight: "700", color: c.primaryStrong },
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
    inputLocked: { opacity: 0.6 },
    hint: { fontSize: 12, color: c.sub, marginTop: 4 },
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
