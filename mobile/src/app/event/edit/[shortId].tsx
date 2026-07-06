import { useEffect, useState } from "react";
import { View, Text, ActivityIndicator, StyleSheet } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import EventFormStepper from "../../../components/EventFormStepper";
import { EventDetail, fetchEvent, updateEvent } from "../../../lib/events";

export default function EditEventScreen() {
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
          <ActivityIndicator size="large" color="#3b82f6" />
        )}
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: `Modifier — ${event.title}` }} />
      <EventFormStepper
        initial={event}
        submitLabel="💾 Enregistrer"
        onSubmit={async (payload) => {
          await updateEvent(shortId!, payload);
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
});
