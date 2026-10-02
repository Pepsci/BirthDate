// analytics/acquisition.js
// Provenance du visiteur, relevée UNE fois au chargement du site.
//
// Rien n'est écrit sur l'appareil (ni cookie, ni localStorage) : les valeurs
// vivent en mémoire, le temps de l'onglet, et ne partent qu'avec la requête
// d'inscription. Sans création de compte, il n'en reste rien.
//
// ⚠️ Soumis au consentement « cookies analytics », comme PostHog. Lire le
// referrer et l'URL par script puis les envoyer peut relever de l'article 82
// de la loi Informatique et Libertés (lecture large du CEPD, lignes
// directrices 2/2023) : on ne les transmet donc que si la personne a dit oui.
// Sans consentement, le serveur garde seulement ce qu'il reçoit de toute
// façon (plateforme, navigateur) et le parrain, déjà en base.
//
// Le serveur refait le tri (utils/signupSource.js) : il ne garde que le
// domaine du referrer et le chemin de la page d'arrivée.

import { hasAnalyticsConsent } from "./analytics";

function readSource() {
  try {
    const params = new URLSearchParams(window.location.search);
    return {
      referrer: document.referrer || "",
      landingPath: window.location.pathname,
      utmSource: params.get("utm_source") || "",
      utmMedium: params.get("utm_medium") || "",
      utmCampaign: params.get("utm_campaign") || "",
    };
  } catch (_) {
    return {};
  }
}

// Évalué à l'import du module (voir main.jsx), donc avant que le routeur ne
// change d'URL : c'est bien la page par laquelle la personne est entrée.
const source = readSource();

// Consentement relu au moment de l'inscription, pas au chargement : la
// personne a pu répondre au bandeau entre-temps, dans un sens ou dans l'autre.
export function getSignupSource() {
  return hasAnalyticsConsent() ? source : {};
}
