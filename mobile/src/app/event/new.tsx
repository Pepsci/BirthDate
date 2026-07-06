import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import EventFormStepper from "../../components/EventFormStepper";
import { createEvent } from "../../lib/events";

export default function NewEventScreen() {
  const router = useRouter();
  // Pré-remplissage depuis une fiche anniversaire (bouton 🎉)
  const params = useLocalSearchParams<{
    forPerson?: string;
    forDate?: string;
    personName?: string;
  }>();

  return (
    <>
      <Stack.Screen options={{ title: "Nouvel événement" }} />
      <EventFormStepper
        prefillName={params.personName}
        isBirthday={!!(params.forPerson || params.forDate)}
        submitLabel="🎉 Créer l'événement"
        onSubmit={async (payload) => {
          const ev = await createEvent({
            ...payload,
            forPerson: params.forPerson || null,
            forDate: params.forDate || null,
          });
          router.replace(`/event/invite/${ev.shortId}`);
        }}
      />
    </>
  );
}
