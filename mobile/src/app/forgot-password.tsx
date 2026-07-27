import { Redirect } from "expo-router";

/**
 * Le mot de passe oublié est devenu un panneau de l'écran /login.
 * Route conservée pour les deep links et la garde d'auth du _layout.
 */
export default function ForgotPasswordRedirect() {
  return <Redirect href="/login?panel=forgot" />;
}
