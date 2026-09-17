import { useLocalSearchParams } from "expo-router";
import PoolContribute from "../../../components/PoolContribute";

/**
 * Écran plein de contribution à une cagnotte. La logique est dans
 * PoolContribute, partagée avec le panneau de droite de la page événement.
 */
export default function PoolContributeScreen() {
  const { shortId } = useLocalSearchParams<{ shortId: string }>();
  return <PoolContribute shortId={shortId} />;
}
