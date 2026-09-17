import { useLocalSearchParams } from "expo-router";
import EventChat from "../../../components/EventChat";

/**
 * Écran plein du chat d'un événement. Toute la logique est dans EventChat,
 * partagée avec le panneau de droite de la page événement en paysage.
 */
export default function EventChatScreen() {
  const { shortId } = useLocalSearchParams<{ shortId: string }>();
  return <EventChat shortId={shortId} />;
}
