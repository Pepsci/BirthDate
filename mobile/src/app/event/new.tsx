import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import NewEventForm from "../../components/NewEventForm";

/**
 * Écran plein de création d'événement (téléphone, onglet Événements).
 * La logique — formulaire, brouillon automatique — est dans NewEventForm,
 * partagée avec le panneau de droite de la carte en grand écran.
 */
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
      <NewEventForm
        forPerson={params.forPerson || null}
        forDate={params.forDate || null}
        personName={params.personName}
        onCreated={(shortId) => router.replace(`/event/invite/${shortId}`)}
      />
    </>
  );
}
