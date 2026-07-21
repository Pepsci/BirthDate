import { useEffect, useState } from "react";
import { View, Text, Pressable, StyleSheet, Alert, ActivityIndicator } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import DateForm from "../../../components/DateForm";
import { DateEntry, fetchDate, updateDate, deleteDate } from "../../../lib/dates";
import {
  useTheme,
  useThemedStyles,
  ThemeColors,
} from "../../../lib/theme-context";

export default function EditDateScreen() {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [entry, setEntry] = useState<DateEntry | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    fetchDate(id)
      .then(setEntry)
      .catch((e) => setError(e?.message ?? "Erreur de chargement."));
  }, [id]);

  const confirmDelete = () => {
    Alert.alert(
      "Supprimer cette date ?",
      `${entry?.name} ${entry?.surname ?? ""} sera retiré·e de ta liste.`,
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Supprimer",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteDate(id!);
              // On saute la carte détail (désormais supprimée → 404 « date
              // introuvable ») et on revient directement à la liste. La
              // transition native de la stack fait l'animation de sortie ;
              // useFocusEffect de la liste recharge → la carte disparaît.
              if (router.canDismiss()) router.dismissAll();
              else router.replace("/(tabs)");
            } catch (e: any) {
              setError(e?.message ?? "Erreur lors de la suppression.");
            }
          },
        },
      ],
    );
  };

  if (!entry) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title: "Modifier" }} />
        {error ? (
          <Text style={styles.error}>{error}</Text>
        ) : (
          <ActivityIndicator size="large" color={colors.primary} />
        )}
      </View>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: `Modifier ${entry.name}`,
          headerRight: () => (
            <Pressable onPress={confirmDelete} hitSlop={10} style={styles.deleteBtn}>
              <Text style={styles.delete}>🗑️</Text>
            </Pressable>
          ),
        }}
      />
      {error && <Text style={styles.error}>{error}</Text>}
      <DateForm
        initial={entry}
        submitLabel="Enregistrer"
        onSubmit={async (payload) => {
          await updateDate(id!, payload);
          router.back();
        }}
      />
    </>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: c.bg,
  },
  error: { color: c.danger, textAlign: "center", padding: 8 },
  deleteBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  delete: {
    fontSize: 18,
    includeFontPadding: false,
    textAlignVertical: "center",
  },
});
