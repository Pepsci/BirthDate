import { useLocalSearchParams } from "expo-router";
import EventInviteFriends from "../../../components/EventInviteFriends";

/**
 * Écran plein d'invitation à un événement (étape qui suit la création).
 * La logique est dans EventInviteFriends, partagée avec le panneau de droite
 * de la page événement en paysage.
 */
export default function EventInviteScreen() {
  const { shortId } = useLocalSearchParams<{ shortId: string }>();
  return <EventInviteFriends shortId={shortId} />;
}
