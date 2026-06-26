import { loadStripe } from "@stripe/stripe-js";

// Chargé une seule fois, réutilisé partout (recommandation Stripe).
// En charge directe, on passe le compte connecté via l'option stripeAccount.
let stripePromiseCache = {};

export const getStripe = (connectedAccountId) => {
  const key = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
  const cacheKey = connectedAccountId || "platform";
  if (!stripePromiseCache[cacheKey]) {
    stripePromiseCache[cacheKey] = loadStripe(
      key,
      connectedAccountId ? { stripeAccount: connectedAccountId } : undefined,
    );
  }
  return stripePromiseCache[cacheKey];
};
