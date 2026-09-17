import { useLocalSearchParams } from "expo-router";
import DMChat from "../../components/DMChat";

/**
 * Écran plein de conversation privée. Toute la logique est dans DMChat,
 * partagée avec le panneau de droite de la carte en grand écran.
 */
export default function DMChatScreen() {
  const { friendId, name, avatar } = useLocalSearchParams<{
    friendId: string;
    name?: string;
    avatar?: string;
  }>();

  return <DMChat friendId={friendId} name={name} avatar={avatar} />;
}
