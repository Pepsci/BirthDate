// analytics/analytics.js
// Wrapper PostHog Cloud EU — conditionné au consentement cookies (RGPD).
// Si VITE_POSTHOG_KEY est absente, toutes les fonctions sont des no-op.

import posthog from "posthog-js";

const KEY = import.meta.env.VITE_POSTHOG_KEY;
const HOST = import.meta.env.VITE_POSTHOG_HOST || "https://eu.i.posthog.com";

let initialized = false;

// Consentement analytics lu depuis les préférences posées par CookieBanner
export function hasAnalyticsConsent() {
  try {
    const prefs = JSON.parse(localStorage.getItem("cookie-preferences"));
    return prefs?.analytics === true;
  } catch (_) {
    return false;
  }
}

export function initAnalytics() {
  if (!KEY || initialized || !hasAnalyticsConsent()) return;
  posthog.init(KEY, {
    api_host: HOST,
    capture_pageview: false, // géré manuellement (SPA, voir AnalyticsTracker)
    capture_pageleave: true,
    autocapture: true,
    persistence: "localStorage+cookie",
    session_recording: {
      maskAllInputs: true, // ne jamais enregistrer le contenu des champs
    },
  });
  initialized = true;
}

// À appeler quand l'utilisateur accepte les cookies
export function enableAnalytics() {
  initAnalytics();
  if (initialized) posthog.opt_in_capturing();
}

// À appeler quand l'utilisateur refuse
export function disableAnalytics() {
  if (initialized) posthog.opt_out_capturing();
}

export function trackPageview(path) {
  if (!initialized) return;
  posthog.capture("$pageview", { $current_url: window.location.href, path });
}

export function trackEvent(name, properties = {}) {
  if (!initialized) return;
  posthog.capture(name, properties);
}

// Identifie l'utilisateur connecté par son id Mongo (pas d'email → minimisation)
export function identifyUser(userId) {
  if (!initialized || !userId) return;
  posthog.identify(String(userId));
}

export function resetAnalytics() {
  if (!initialized) return;
  posthog.reset();
}
