/**
 * Langue de l'utilisateur côté serveur (`User.language`).
 *
 * L'app affiche la langue du téléphone (ou celle choisie dans Profil), mais le
 * serveur écrit aussi des textes sans que l'app soit ouverte : notifications
 * push, emails, rappels de minuit. Il a donc besoin de connaître la langue du
 * compte. On la lui envoie sans rien demander à l'utilisateur :
 *   - à l'ouverture de session, si elle diffère de celle qu'il a en base ;
 *   - quand la langue change dans Profil.
 *
 * Les erreurs sont ignorées : un serveur plus ancien (route absente) ou une
 * coupure réseau ne doivent jamais gêner l'utilisation. On réessaiera au
 * prochain lancement.
 */
import { getLanguage } from "@/i18n";
import { api } from "./api";
import { isLocalMode } from "./app-mode";

let lastSent: string | null = null;

/**
 * @param serverLanguage langue connue du serveur (`user.language`), si on
 *   vient de recevoir le profil : évite un appel quand tout est déjà à jour.
 */
export function syncLanguageWithServer(serverLanguage?: unknown): void {
  const language = getLanguage();
  if (isLocalMode()) return; // mode sans compte : rien ne part au serveur
  if (serverLanguage === language || lastSent === language) return;
  lastSent = language;
  api("/users/me/language", {
    method: "PATCH",
    body: JSON.stringify({ language }),
  }).catch(() => {
    lastSent = null;
  });
}
