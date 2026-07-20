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
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { DateEntry, DatePayload, formatBirthday } from "../lib/dates";
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
    initial ? new Date(initial.date) : new Date(2000, 0, 1),
  );
  const [family, setFamily] = useState(initial?.family ?? false);
  const [showPicker, setShowPicker] = useState(Platform.OS === "ios");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

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

      <Text style={styles.hint}>
        🎉 La fête (nameday) est détectée automatiquement depuis le prénom.
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
    submitText: { color: "#fff", fontWeight: "600", fontSize: 16 },
  });
