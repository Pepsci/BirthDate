import { useEffect, useState } from "react";
import { View, Text, Pressable, StyleSheet, Alert, ActivityIndicator } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import DateForm from "../../../components/DateForm";
import { DateEntry, fetchDate, updateDate, deleteDate } from "../../../lib/dates";

export default function EditDateScreen() {
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
              router.back();
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
          <ActivityIndicator size="large" color="#3b82f6" />
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
            <Pressable onPress={confirmDelete} hitSlop={10}>
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

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f9fafb",
  },
  error: { color: "#b91c1c", textAlign: "center", padding: 8 },
  delete: { fontSize: 18 },
});
