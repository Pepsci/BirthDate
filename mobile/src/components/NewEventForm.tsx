import { useEffect, useRef } from "react";
import EventFormStepper, { EventFormSnapshot } from "./EventFormStepper";
import { createEvent } from "../lib/events";

/**
 * Création d'un événement, sans l'écran autour.
 *
 * Deux usages :
 * - `app/event/new.tsx` : écran plein (téléphone, onglet Événements) ;
 * - `app/date/[id].tsx` en grand écran : panneau de droite, la carte de la
 *   personne restant visible à gauche.
 *
 * Toute la logique vit ici pour que les deux se comportent pareil, en
 * particulier le brouillon automatique : quitter le formulaire sans valider
 * (retour, changement de panneau, pliage de l'appareil) enregistre
 * l'événement en brouillon dès qu'un titre a été saisi.
 */
export default function NewEventForm({
  forPerson,
  forDate,
  personName,
  onCreated,
}: {
  forPerson: string | null;
  forDate: string | null;
  personName?: string;
  /** Appelé après création réussie — au parent de décider où aller ensuite. */
  onCreated: (shortId: string) => void;
}) {
  const snapshot = useRef<EventFormSnapshot | null>(null);
  // Cibles gardées en ref : useLocalSearchParams peut les livrer après le
  // premier render, et l'effet de sauvegarde ci-dessous doit rester monté une
  // seule fois (sinon un changement de paramètre déclenche son cleanup et crée
  // un brouillon alors qu'on n'a pas quitté le formulaire).
  const targetRef = useRef({ forPerson, forDate });
  targetRef.current = { forPerson, forDate };

  // Sortie sans avoir validé : si un titre avait été saisi, on enregistre
  // l'événement en brouillon pour pouvoir reprendre depuis l'onglet
  // Événements. Silencieux par choix — le formulaire est déjà en train de
  // disparaître, une alerte n'y serait pas vue.
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
    <EventFormStepper
      prefillName={personName}
      isBirthday={!!(forPerson || forDate)}
      submitLabel="🎉 Créer l'événement"
      snapshotRef={snapshot}
      onSubmit={async (payload) => {
        const ev = await createEvent({
          ...payload,
          forPerson,
          forDate,
        });
        onCreated(ev.shortId);
      }}
    />
  );
}
