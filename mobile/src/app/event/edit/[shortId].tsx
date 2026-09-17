import { useEffect, useState } from "react";
import {
  View,
  Text,
  ActivityIndicator,
  StyleSheet,
  Alert,
} from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import EventFormStepper from "../../../components/EventFormStepper";
import {
  EventDetail,
  deleteEvent,
  fetchEvent,
  updateEvent,
} from "../../../lib/events";
import HeaderIconButton from "../../../components/HeaderIconButton";
import {
  useTheme,
  useThemedStyles,
  ThemeColors,
} from "../../../lib/theme-context";

export default function EditEventScreen() {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  const { shortId } = useLocalSearchParams<{ shortId: string }>();
  const router = useRouter();
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!shortId) return;
    fetchEvent(shortId)
      .then(setEvent)
      .catch((e) => setError(e?.message ?? "Erreur de chargement."));
  }, [shortId]);

  if (!event) {
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

  // Reprise d'un brouillon : la validation le publie et enchaîne sur les
  // invitations, comme à la fin d'une création normale.
  const isDraft = event.status === "draft";

  const confirmDeleteDraft = () => {
    Alert.alert(
      "Supprimer ce brouillon ?",
      "Il sera supprimé définitivement.",
      [
        { text: "Garder", style: "cancel" },
        {
          text: "Supprimer",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteEvent(shortId!);
              router.replace("/events");
            } catch (e: any) {
              Alert.alert(
                "Suppression impossible",
                e?.message ?? "Réessaie dans un instant.",
              );
            }
          },
        },
      ],
    );
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: isDraft ? `Brouillon ${event.title}` : `Modifier ${event.title}`,
          headerRight: isDraft
            ? () => (
                <HeaderIconButton
                  name="trash"
                  onPress={confirmDeleteDraft}
                  accessibilityLabel="Supprimer ce brouillon"
                />
              )
            : undefined,
        }}
      />
      <EventFormStepper
        initial={event}
        submitLabel={isDraft ? "🎉 Publier l'événement" : "💾 Enregistrer"}
        onSubmit={async (payload) => {
          await updateEvent(shortId!, {
            ...payload,
            ...(isDraft ? { status: "published" as const } : {}),
          });
          if (isDraft) router.replace(`/event/invite/${shortId}`);
          else router.back();
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
