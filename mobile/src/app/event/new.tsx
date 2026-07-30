import { useEffect, useRef } from "react";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import EventFormStepper, {
  EventFormSnapshot,
} from "../../components/EventFormStepper";
import { createEvent } from "../../lib/events";

export default function NewEventScreen() {
  const router = useRouter();
  // Pré-remplissage depuis une fiche anniversaire (bouton 🎉)
  const params = useLocalSearchParams<{
    forPerson?: string;
    forDate?: string;
    personName?: string;
  }>();

  const forPerson = params.forPerson || null;
  const forDate = params.forDate || null;

  const snapshot = useRef<EventFormSnapshot | null>(null);
  // Cibles de l'événement gardées en ref : useLocalSearchParams peut les
  // livrer après le premier render, et l'effet de sauvegarde ci-dessous doit
  // rester monté une seule fois (sinon un changement de paramètre déclenche
  // son cleanup et crée un brouillon alors qu'on n'a pas quitté l'écran).
  const targetRef = useRef({ forPerson, forDate });
  targetRef.current = { forPerson, forDate };

  // Sortie de l'écran (retour, geste, changement d'onglet) sans avoir validé :
  // si un titre avait été saisi, on enregistre l'événement en brouillon pour
  // pouvoir reprendre depuis l'onglet Événements. Silencieux par choix —
  // l'écran est déjà en train de disparaître, une alerte n'y serait pas vue.
  useEffect(() => {
    return () => {
      const snap = snapshot.current;
      if (!snap || snap.submitted || !snap.hasContent) return;
      createEvent({
        ...snap.payload,
        ...targetRef.current,
        status: "draft",
      }).catch(() => {});
    };
  }, []);

  return (
    <>
      <Stack.Screen options={{ title: "Nouvel événement" }} />
      <EventFormStepper
        prefillName={params.personName}
        isBirthday={!!(forPerson || forDate)}
        submitLabel="🎉 Créer l'événement"
        snapshotRef={snapshot}
        onSubmit={async (payload) => {
          const ev = await createEvent({
            ...payload,
            forPerson,
            forDate,
          });
          router.replace(`/event/invite/${ev.shortId}`);
        }}
      />
    </>
  );
}
