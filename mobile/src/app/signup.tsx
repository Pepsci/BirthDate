import { Redirect } from "expo-router";

/**
 * L'inscription est devenue un panneau de l'écran /login (pager à 3 volets).
 * Cette route est conservée pour ne casser ni les deep links existants ni la
 * garde d'auth du _layout — elle redirige simplement vers le bon panneau.
 */
export default function SignupRedirect() {
  return <Redirect href="/login?panel=signup" />;
}
