const Stripe = require("stripe");

if (!process.env.STRIPE_SECRET_KEY) {
  console.warn(
    "⚠️  STRIPE_SECRET_KEY manquant — la cagnotte ne fonctionnera pas tant que la clé n'est pas définie.",
  );
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  // Optionnel : épingle la version API affichée dans ton dashboard Stripe pour
  // te protéger des breaking changes. Laisse commenté = version par défaut du compte.
  // apiVersion: "2025-XX-XX",
  appInfo: { name: "BirthReminder", url: "https://birthreminder.com" },
});

module.exports = stripe;
