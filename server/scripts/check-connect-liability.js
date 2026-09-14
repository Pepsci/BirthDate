// scripts/check-connect-liability.js
//
// Qui paie quand un compte connecté part en négatif ?
//
// Sur des charges directes, un chargeback est d'abord débité du solde du
// compte de l'ORGANISATEUR. S'il l'a déjà vidé sur sa banque, Stripe tente de
// débiter son compte externe — et si ça échoue, la perte remonte soit à
// Stripe, soit à NOUS, selon `controller.losses.payments`.
//
//   "stripe"      → Stripe couvre
//   "application" → BirthReminder couvre (réserve retenue sur notre solde,
//                   ponction après 180 jours de négatif)
//
// ⚠️ "application" est la valeur ATTENDUE, pas une anomalie : Stripe refuse
// de dissocier le tableau de bord Express de la responsabilité des pertes
// (« When stripe_dashboard[type]=express, your platform must collect fees and
// be liable for negative balances or refunds and chargebacks »). Ce script
// sert donc à repérer un compte qui SORTIRAIT de la configuration attendue,
// pas à réclamer une bascule impossible.
//
// Lecture seule. Usage : node scripts/check-connect-liability.js

require("dotenv").config();
const mongoose = require("mongoose");
const stripe = require("../config/stripe.config");
const StripeAccount = require("../models/stripeAccount.model");

(async () => {
  await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI);

  const accounts = await StripeAccount.find().select("stripeAccountId user");
  console.log(`\n${accounts.length} compte(s) connecté(s) en base.\n`);

  const tally = {};

  for (const a of accounts) {
    try {
      const acct = await stripe.accounts.retrieve(a.stripeAccountId);
      const losses = acct.controller?.losses?.payments ?? "(non exposé)";
      const fees = acct.controller?.fees?.payer ?? "(non exposé)";
      tally[losses] = (tally[losses] || 0) + 1;

      console.log(
        `${a.stripeAccountId}  type=${acct.type || "v2"}  ` +
          `pertes=${losses}  frais=${fees}  ` +
          `charges=${acct.charges_enabled ? "on" : "off"}  ` +
          `payouts=${acct.payouts_enabled ? "on" : "off"}`,
      );
    } catch (e) {
      console.log(`${a.stripeAccountId}  ⚠️  illisible : ${e.message}`);
    }
  }

  console.log("\n── Récapitulatif ──");
  for (const [k, n] of Object.entries(tally)) {
    const verdict =
      k === "application"
        ? "BirthReminder porte la perte (attendu avec Express)"
        : k === "stripe"
          ? "Stripe porte la perte"
          : "?";
    console.log(`  ${k} : ${n} compte(s)  ${verdict}`);
  }
  console.log();

  await mongoose.disconnect();
})();
