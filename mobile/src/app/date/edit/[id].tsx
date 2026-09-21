import { useEffect, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import DateForm from "../../../components/DateForm";
import HeaderIconButton from "../../../components/HeaderIconButton";
import { DateEntry, fetchDate, updateDate } from "../../../lib/dates";
import { confirmDeleteDate } from "../../../components/DateEditPane";
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
    if (!entry) return;
    confirmDeleteDate(
      entry,
      () => {
        // On saute la carte détail (désormais supprimée → 404 « date
        // introuvable ») et on revient directement à la liste. La
        // transition native de la stack fait l'animation de sortie ;
        // useFocusEffect de la liste recharge → la carte disparaît.
        if (router.canDismiss()) router.dismissAll();
        else router.replace("/(tabs)");
      },
      setError,
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
            <HeaderIconButton
              name="trash"
              accessibilityLabel="Supprimer cette date"
              onPress={confirmDelete}
            />
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
});
