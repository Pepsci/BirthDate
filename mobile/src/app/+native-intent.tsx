import { webLinkToMobileRoute } from "../lib/push";
import { markWelcomeSeen } from "../lib/welcome-gate";

/**
 * Hook officiel Expo Router : intercepte TOUTE URL entrante (Universal Links
 * iOS / App Links Android ouverts depuis un email, ou deep link maison) et la
 * réécrit vers la bonne route mobile AVANT que le routeur ne s'exécute.
 *
 * Les liens des emails visent le web ("/home?tab=date&dateId=…") : on les
 * traduit via webLinkToMobileRoute (mutualisée avec les notifications push).
 */
export function redirectSystemPath({
  path,
  initial,
}: {
  path: string;
  initial: boolean;
}): string {
  try {
    const route = webLinkToMobileRoute(path);
    // Ouverture via un lien → ne pas détourner vers l'écran /welcome.
    if (route && route !== "/") markWelcomeSeen();
    return route;
  } catch {
    // En cas de pépin, on laisse Expo Router router le path d'origine.
    return path;
  }
}
