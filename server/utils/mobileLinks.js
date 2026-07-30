/**
 * Ponts « lien web → route app mobile ».
 *
 * Les emails pointent tous vers des URLs https://birthreminder.com/… : c'est
 * ce qu'il faut, parce qu'un lien https fonctionne partout (webmail desktop,
 * navigateur mobile) et qu'il ouvre directement l'app quand les Universal
 * Links iOS / App Links Android sont vérifiés.
 *
 * Reste le cas où la vérification n'a pas eu lieu (app installée hors store,
 * App Links Android pas encore validés, client mail qui court-circuite le
 * système) : on ajoute alors un second lien en schéma maison
 * `birthreminder://…`, qui lui va toujours à l'app. Ce lien n'est proposé
 * qu'aux comptes qui ont un appareil mobile enregistré — inutile de polluer
 * l'email des utilisateurs web-only.
 *
 * ⚠️ La table de correspondance ci-dessous doit rester alignée sur
 * `mobile/src/lib/push.ts` → `webLinkToMobileRoute()`, qui fait la même
 * traduction côté app pour les liens entrants.
 */

const APP_SCHEME = "birthreminder://";

/**
 * Un compte a-t-il au moins un appareil mobile (app installée + push
 * enregistré) ? On se base sur les tokens Expo, seul signal fiable côté
 * serveur : ils sont posés par `POST /push/expo-token` au lancement de l'app.
 *
 * @param {object} user document User (ou objet contenant expoPushTokens)
 * @returns {boolean}
 */
function hasMobileApp(user) {
  if (!user) return false;
  const tokens = user.expoPushTokens;
  return Array.isArray(tokens) && tokens.length > 0;
}

/**
 * Traduit un lien web BirthReminder en route mobile (sans le schéma).
 * Renvoie null si aucune route mobile ne correspond : dans ce cas on ne
 * propose pas de lien app plutôt que d'envoyer l'utilisateur sur l'accueil.
 *
 * @param {string} webUrl URL absolue ou chemin ("/home?tab=date&dateId=…")
 * @returns {string|null} ex. "date/64f…"
 */
function webPathToMobileRoute(webUrl) {
  if (!webUrl) return null;

  let path = String(webUrl);
  if (/^https?:\/\//i.test(path)) {
    try {
      const u = new URL(path);
      path = u.pathname + u.search;
    } catch {
      // URL malformée : on continue sur la chaîne brute
    }
  }

  // Événement : /event/:shortId → event/:shortId
  const event = path.match(/^\/event\/([^/?#]+)/);
  if (event) return `event/${event[1]}`;

  // Réinitialisation de mot de passe : /auth/reset/:token
  const reset = path.match(/^\/auth\/reset\/([^/?#]+)/);
  if (reset) return `auth/reset/${reset[1]}`;

  if (path.includes("/shared-invites")) return "shared-invites";
  if (path.includes("tab=events")) return "events";
  if (path.includes("tab=agenda")) return "agenda";

  if (path.includes("tab=date")) {
    const id = path.match(/dateId=([a-f0-9]+)/i);
    if (id) return `date/${id[1]}`;
  }

  if (path.includes("tab=chat")) {
    const friend = path.match(/friendId=([a-f0-9]+)/i);
    if (friend) return `chat-open?friendId=${friend[1]}`;
    const conv = path.match(/conversationId=([a-f0-9]+)/i);
    if (conv) return `chat-open?conversationId=${conv[1]}`;
    return "chats";
  }

  if (path.includes("tab=friends")) return "friends";

  // Accueil sans onglet identifiable (ex. rappel de son propre anniversaire) →
  // racine de l'app. Chaîne vide volontaire : elle donne "birthreminder://".
  if (path === "/" || /^\/home\b/.test(path)) return "";

  return null;
}

/**
 * Lien `birthreminder://…` équivalent à un lien web, ou null si la page
 * n'existe pas dans l'app.
 *
 * @param {string} webUrl
 * @returns {string|null}
 */
function webLinkToAppLink(webUrl) {
  const route = webPathToMobileRoute(webUrl);
  // route === "" est valide (racine de l'app) : on compare à null.
  return route === null ? null : `${APP_SCHEME}${route}`;
}

/**
 * Lien app à glisser dans un email, uniquement si le destinataire a un
 * appareil mobile enregistré ET que la page existe dans l'app.
 *
 * @param {object} user destinataire
 * @param {string} webUrl lien web équivalent
 * @returns {string|null}
 */
function appLinkFor(user, webUrl) {
  if (!hasMobileApp(user)) return null;
  return webLinkToAppLink(webUrl);
}

module.exports = {
  APP_SCHEME,
  hasMobileApp,
  webPathToMobileRoute,
  webLinkToAppLink,
  appLinkFor,
};
