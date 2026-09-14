// scripts/diagnose-payouts.js
//
// « J'ai encaissé, mais l'argent n'est jamais arrivé sur mon compte bancaire. »
//
// En charges directes, BirthReminder ne voit rien de ce qui se passe côté
// versement : les fonds vivent sur le compte connecté de l'organisateur et
// Stripe les vire selon SON calendrier, avec SES conditions. Quand ça ne part
// pas, la cause est presque toujours l'une des cinq ci-dessous — et aucune
// n'est visible depuis l'application.
//
//   1. payouts_enabled = false : onboarding incomplet, vérification d'identité
//      ou RIB manquant. L'argent s'accumule sans jamais partir.
//   2. requirements.currently_due non vide : Stripe attend un document.
//   3. schedule.interval = "manual" : aucun virement automatique, il faut les
//      déclencher à la main.
//   4. Fonds encore en `pending` : délai de règlement non écoulé.
//   5. Solde sous le minimum de virement.
//
// Lecture seule. Usage :
//   node scripts/diagnose-payouts.js              (tous les comptes en base)
//   node scripts/diagnose-payouts.js <email>      (celui d'un utilisateur)
//   node scripts/diagnose-payouts.js acct_xxx     (par identifiant Stripe)
//
// ⚠️ La troisième forme existe pour les comptes ORPHELINS : un compte dont la
// ligne en base a été supprimée (reset --local-only, ou utilisateur effacé)
// continue d'exister chez Stripe, et peut très bien détenir de l'argent. Il
// devient alors invisible d'une recherche par utilisateur — il faut pouvoir
// l'interroger par son identifiant.

require("dotenv").config();
const mongoose = require("mongoose");
const stripe = require("../config/stripe.config");
const User = require("../models/user.model");
const StripeAccount = require("../models/stripeAccount.model");

const euros = (c) => `${((c || 0) / 100).toFixed(2)} €`;
const targetEmail = process.argv[2];

(async () => {
  await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI);

  // Interrogation directe d'un compte Stripe, sans passer par la base.
  if (targetEmail && /^acct_/.test(targetEmail)) {
    await inspect({ stripeAccountId: targetEmail, user: null });
    console.log("═".repeat(70));
    await mongoose.disconnect();
    return;
  }

  let query = {};
  if (targetEmail) {
    const u = await User.findOne({ email: targetEmail.toLowerCase() });
    if (!u) {
      console.error(`\n❌ Aucun utilisateur avec l'email ${targetEmail}\n`);
      await mongoose.disconnect();
      process.exit(1);
    }
    query = { user: u._id };
  }

  const accounts = await StripeAccount.find(query).populate(
    "user",
    "name surname email",
  );
  console.log(`\n${accounts.length} compte(s) à examiner.\n`);

  for (const record of accounts) {
    await inspect(record);
  }

  console.log("═".repeat(70));
  console.log(
    "\nℹ️  L'organisateur règle tout ça depuis son tableau de bord Express\n" +
      "   (route POST /api/stripe/connect/dashboard).\n",
  );

  await mongoose.disconnect();
})();

async function inspect(record) {
  {
    const who = record.user
      ? `${record.user.name} ${record.user.surname || ""} <${record.user.email}>`
      : "(utilisateur supprimé)";
    console.log("═".repeat(70));
    console.log(`${who}\n${record.stripeAccountId}`);

    let acct;
    try {
      acct = await stripe.accounts.retrieve(record.stripeAccountId);
    } catch (e) {
      console.log(`  ⚠️  Illisible : ${e.message}\n`);
      return;
    }

    const sum = (arr) =>
      (arr || [])
        .filter((b) => b.currency === "eur")
        .reduce((t, b) => t + b.amount, 0);

    let available = 0;
    let pending = 0;
    try {
      const bal = await stripe.balance.retrieve(
        {},
        { stripeAccount: record.stripeAccountId },
      );
      available = sum(bal.available);
      pending = sum(bal.pending);
    } catch (e) {
      console.log(`  ⚠️  Solde illisible : ${e.message}`);
    }

    const sched = acct.settings?.payouts?.schedule || {};
    const req = acct.requirements || {};
    const due = [...(req.currently_due || []), ...(req.past_due || [])];

    console.log(`  Disponible        : ${euros(available)}`);
    console.log(`  En attente        : ${euros(pending)}`);
    console.log(`  charges_enabled   : ${acct.charges_enabled}`);
    console.log(`  payouts_enabled   : ${acct.payouts_enabled}`);
    console.log(`  details_submitted : ${acct.details_submitted}`);
    console.log(
      `  Calendrier        : ${sched.interval || "?"}` +
        (sched.delay_days != null ? ` (délai ${sched.delay_days} j)` : ""),
    );
    console.log(`  Comptes bancaires : ${acct.external_accounts?.total_count ?? "?"}`);

    let payouts = [];
    try {
      const list = await stripe.payouts.list(
        { limit: 5 },
        { stripeAccount: record.stripeAccountId },
      );
      payouts = list.data;
    } catch (_) {}

    if (payouts.length === 0) {
      console.log("  Virements         : AUCUN");
    } else {
      console.log("  Virements         :");
      payouts.forEach((p) => {
        const d = p.arrival_date
          ? new Date(p.arrival_date * 1000).toLocaleDateString("fr-FR")
          : "?";
        console.log(
          `     ${euros(p.amount)}  ${p.status.padEnd(11)} arrivée ${d}` +
            (p.failure_message ? `  ⚠️ ${p.failure_message}` : ""),
        );
      });
    }

    // ── Verdict ──────────────────────────────────────────────────────────
    console.log("\n  → Diagnostic :");
    let found = false;

    if (!acct.details_submitted) {
      found = true;
      console.log(
        "     ⛔ Onboarding non terminé. L'argent est encaissé mais ne peut pas\n" +
          "        être versé tant que Stripe n'a pas toutes les informations.",
      );
    }
    if (due.length > 0) {
      found = true;
      console.log(`     ⛔ Stripe attend : ${due.join(", ")}`);
    }
    if (!acct.payouts_enabled) {
      found = true;
      console.log(
        "     ⛔ Versements désactivés sur ce compte — c'est LA cause la plus\n" +
          "        fréquente d'un solde qui ne bouge pas.",
      );
    }
    if ((acct.external_accounts?.total_count ?? 0) === 0) {
      found = true;
      console.log("     ⛔ Aucun compte bancaire enregistré : rien où virer.");
    }
    if (sched.interval === "manual") {
      found = true;
      console.log(
        "     ⚠️  Calendrier MANUEL : aucun virement automatique, il faut les\n" +
          "        déclencher explicitement.",
      );
    }
    if (available === 0 && pending > 0) {
      found = true;
      console.log(
        `     ⏳ ${euros(pending)} encore en attente de règlement. Normal, il faut\n` +
          "        laisser passer le délai.",
      );
    }
    if (!found) {
      if (available > 0) {
        console.log(
          `     ⚠️  ${euros(available)} disponibles et rien ne bloque visiblement.\n` +
            "        Probablement sous le minimum de virement de Stripe : les petits\n" +
            "        reliquats restent en attente d'un montant suffisant.",
        );
      } else {
        console.log("     ✅ Rien à signaler : solde nul, tout a été versé.");
      }
    }
    console.log();
  }
}
