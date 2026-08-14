import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Platform,
  Switch,
  ActivityIndicator,
  ScrollView,
  Alert,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { Image as ExpoImage } from "expo-image";
import {
  DateEntry,
  DatePayload,
  formatBirthday,
  updateDatePhoto,
  removeDatePhoto,
} from "../lib/dates";
import NamedayPicker from "./NamedayPicker";
import {
  useTheme,
  useThemedStyles,
  ThemeColors,
} from "../lib/theme-context";

interface Props {
  initial?: DateEntry;
  submitLabel: string;
  onSubmit: (payload: DatePayload) => Promise<void>;
}

export default function DateForm({ initial, submitLabel, onSubmit }: Props) {
  const { colors, resolved } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [name, setName] = useState(initial?.name ?? "");
  const [surname, setSurname] = useState(initial?.surname ?? "");
  const [date, setDate] = useState<Date>(
    initial ? new Date(initial.date) : new Date(),
  );
  const [family, setFamily] = useState(initial?.family ?? false);
  // null = laisser le serveur détecter la fête depuis le prénom (création),
  // ou retirer la fête existante (édition).
  const [nameday, setNameday] = useState<string | null>(initial?.nameday ?? null);
  const [namedayTouched, setNamedayTouched] = useState(false);
  const [showPicker, setShowPicker] = useState(Platform.OS === "ios");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Photo de carte — uniquement en édition (il faut un dateId existant pour
  // PATCH /date/:id/photo), et jamais pour une date liée à un ami (cet écran
  // n'est de toute façon pas accessible dans ce cas — voir date/[id].tsx).
  const [photo, setPhoto] = useState<string | null | undefined>(initial?.photo);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const pickPhoto = async () => {
    if (!initial) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (result.canceled || !result.assets[0]) return;
    setUploadingPhoto(true);
    setError(null);
    try {
      // HEIC (photos iPhone) → JPEG, comme pour l'avatar profil.
      const jpeg = await ImageManipulator.manipulateAsync(
        result.assets[0].uri,
        [{ resize: { width: 512 } }],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG },
      );
      const updated = await updateDatePhoto(initial._id, jpeg.uri);
      setPhoto(updated.photo);
    } catch (e: any) {
      setError(e?.message ?? "Erreur lors de l'upload de la photo.");
    } finally {
      setUploadingPhoto(false);
    }
  };

  const confirmRemovePhoto = () => {
    if (!initial) return;
    Alert.alert("Supprimer la photo ?", undefined, [
      { text: "Annuler", style: "cancel" },
      {
        text: "Supprimer",
        style: "destructive",
        onPress: async () => {
          setUploadingPhoto(true);
          setError(null);
          try {
            const updated = await removeDatePhoto(initial._id);
            setPhoto(updated.photo);
          } catch (e: any) {
            setError(e?.message ?? "Erreur lors de la suppression.");
          } finally {
            setUploadingPhoto(false);
          }
        },
      },
    ]);
  };

  const submit = async () => {
    if (!name.trim()) {
      setError("Le prénom est obligatoire.");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await onSubmit({
        name: name.trim(),
        surname: surname.trim() || undefined,
        // new Date(y, m, d) côté lecture — ici on envoie l'ISO à midi UTC
        // pour éviter tout glissement de jour lié aux timezones
        date: new Date(
          Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), 12),
        ).toISOString(),
        family,
        // Champ omis tant que l'utilisateur n'y a pas touché : le serveur
        // garde alors sa détection auto depuis le prénom (création) ou la
        // valeur existante (édition). Explicitement null = « pas de fête ».
        ...(nameday !== null || namedayTouched ? { nameday } : {}),
      });
    } catch (e: any) {
      setError(e?.message ?? "Erreur lors de l'enregistrement.");
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
      {initial && (
        <>
          <Text style={styles.label}>Photo</Text>
          <View style={styles.photoRow}>
            <Pressable onPress={pickPhoto} disabled={uploadingPhoto}>
              {photo ? (
                <ExpoImage source={{ uri: photo }} style={styles.photo} />
              ) : (
                <View style={styles.photoFallback}>
                  <Text style={styles.photoFallbackText}>
                    {(name || "?").charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
            </Pressable>
            <View style={styles.photoButtons}>
              <Pressable
                onPress={pickPhoto}
                disabled={uploadingPhoto}
                style={styles.photoBtn}
              >
                {uploadingPhoto ? (
                  <ActivityIndicator color={colors.primary} />
                ) : (
                  <Text style={styles.photoBtnText}>
                    {photo ? "Changer la photo" : "Ajouter une photo"}
                  </Text>
                )}
              </Pressable>
              {photo && !uploadingPhoto && (
                <Pressable onPress={confirmRemovePhoto} style={styles.photoBtn}>
                  <Text style={styles.photoBtnTextDanger}>Retirer</Text>
                </Pressable>
              )}
            </View>
          </View>
        </>
      )}

      <Text style={styles.label}>Prénom *</Text>
      <TextInput placeholderTextColor={colors.placeholder}
        style={styles.input}
        placeholder="Prénom"
        value={name}
        onChangeText={setName}
      />

      <Text style={styles.label}>Nom</Text>
      <TextInput placeholderTextColor={colors.placeholder}
        style={styles.input}
        placeholder="Nom (optionnel)"
        value={surname}
        onChangeText={setSurname}
      />

      <Text style={styles.label}>Date d'anniversaire</Text>
      {Platform.OS === "android" && (
        <Pressable style={styles.input} onPress={() => setShowPicker(true)}>
          <Text style={styles.dateText}>
            {formatBirthday(date.toISOString())} {date.getFullYear()}
          </Text>
        </Pressable>
      )}
      {showPicker && (
        <View style={styles.pickerWrap}>
          <DateTimePicker
            value={date}
            mode="date"
            display={Platform.OS === "ios" ? "spinner" : "default"}
            locale="fr-FR"
            maximumDate={new Date()}
            themeVariant={resolved}
            onChange={(event, selected) => {
              if (Platform.OS === "android") setShowPicker(false);
              if (selected) setDate(selected);
            }}
          />
        </View>
      )}

      <View style={styles.switchRow}>
        <Text style={styles.label}>Famille</Text>
        <Switch
          value={family}
          onValueChange={setFamily}
          trackColor={{ true: colors.primary }}
        />
      </View>

      <Text style={styles.label}>Fête</Text>
      <NamedayPicker
        value={nameday}
        onChange={(next) => {
          setNameday(next);
          setNamedayTouched(true);
        }}
      />
      <Text style={styles.hint}>
        🎉 Détectée automatiquement depuis le prénom si vous n'y touchez pas.
      </Text>

      {error && <Text style={styles.error}>{error}</Text>}

      <Pressable
        style={[styles.submit, saving && { opacity: 0.6 }]}
        onPress={submit}
        disabled={saving}
      >
        {saving ? (
          <ActivityIndicator color={colors.white} />
        ) : (
          <Text style={styles.submitText}>{submitLabel}</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    content: { padding: 16, gap: 6, paddingBottom: 40 },
    label: { fontSize: 13, fontWeight: "700", color: c.sub, marginTop: 10 },
    photoRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
      marginTop: 4,
      marginBottom: 4,
    },
    photo: { width: 64, height: 64, borderRadius: 32 },
    photoFallback: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: c.primarySoft,
      alignItems: "center",
      justifyContent: "center",
    },
    photoFallbackText: { color: c.primary, fontWeight: "700", fontSize: 22 },
    photoButtons: { gap: 8 },
    photoBtn: {
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: c.inputBorder,
      alignItems: "center",
    },
    photoBtnText: { color: c.text, fontSize: 13, fontWeight: "600" },
    photoBtnTextDanger: { color: c.danger, fontSize: 13, fontWeight: "600" },
    input: {
      borderWidth: 1,
      borderColor: c.inputBorder,
      borderRadius: 10,
      padding: 12,
      fontSize: 16,
      backgroundColor: c.inputBg,
      color: c.text,
    },
    dateText: { fontSize: 16, color: c.text },
    // Centre le spinner iOS (sinon collé à gauche)
    pickerWrap: { alignItems: "center", alignSelf: "stretch" },
    switchRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginTop: 6,
    },
    hint: { color: c.faint, fontSize: 12, marginTop: 8 },
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
