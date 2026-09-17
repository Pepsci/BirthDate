import { useLocalSearchParams } from "expo-router";
import PoolConfig from "../../../components/PoolConfig";

/**
 * Écran plein de configuration de la cagnotte. La logique est dans PoolConfig,
 * partagée avec le panneau de droite de la page événement.
 */
export default function PoolConfigScreen() {
  const { shortId } = useLocalSearchParams<{ shortId: string }>();
  return <PoolConfig shortId={shortId} />;
}
