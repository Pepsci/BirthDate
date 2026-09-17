import { useLocalSearchParams } from "expo-router";
import EventNotificationsSettings from "../../../components/EventNotificationsSettings";

/**
 * Écran plein des réglages de notifications d'un événement. La logique est
 * dans EventNotificationsSettings, partagée avec le panneau de droite de la
 * page événement en paysage.
 */
export default function EventNotificationsScreen() {
  const { shortId } = useLocalSearchParams<{ shortId: string }>();
  return <EventNotificationsSettings shortId={shortId} />;
}
