// scripts/verify-connect-config.js
//
// Vérifie la configuration Connect visée AVANT le premier organisateur réel.
//
// Pourquoi ce script existe : `controller.stripe_dashboard.type` est IMMUABLE.
// Une fois des comptes créés en production, on ne peut plus changer d'avis sans
// faire recréer un compte Stripe à chaque organisateur. Se tromper aujourd'hui
// coûte un compte de test ; se tromper dans six mois coûte une migration.
//
// Ce que le script établit réellement :
//   1. que Stripe ACCEPTE la combinaison de propriétés (le point le moins sûr :
//      elle est déduite de la table des combinaisons interdites, pas d'un
//      exemple officiel) ;
//   2. que `losses.payments` vaut bien "stripe" — c'est-à-dire que la perte
//      irrécouvrable ne remonte plus à BirthReminder ;
//   3. que le lien d'onboarding se génère toujours.
//
// Ce qu'il n'établit PAS : le comportement de facturation des frais. Stripe
// signale une variation entre `application_express` et `account` en charges
// directes, et notre lecture de `balance_transaction.fee` en dépend. Cela
// demande un vrai paiement de test — voir l'encadré affiché en fin de script.
//
// ⚠️ À lancer avec des CLÉS DE TEST. Le script refuse de tourner autrement :
// il crée un compte connecté, ce qui n'a rien à faire en production.
//
// Usage : STRIPE_SECRET_KEY=sk_test_xxx node scripts/verify-connect-config.js

const key = process.env.STRIPE_SECRET_KEY || "";
if (!key.startsWith("sk_test_")) {
  console.error(
    "\n⛔ Clé de test requise (sk_test_…). Ce script crée un compte connecté :\n" +
      "   le lancer en production laisserait un compte fantôme derrière lui.\n",
  );
  process.exit(1);
}

const stripe = require("stripe")(key);

const TARGET = {
  "controller.losses.payments": "stripe",
  "controller.fees.payer": "account",
  "controller.requirement_collection": "stripe",
  "controller.stripe_dashboard.type": "express",
};

const get = (obj, path) =>
  path.split(".").reduce((o, k) => (o == null ? undefined : o[k]), obj);

(async () => {
  console.log("\n── Création d'un compte avec les propriétés visées ──\n");

  let account;
  try {
    account = await stripe.accounts.create({
      country: "FR",
      controller: {
        losses: { payments: "stripe" },
        fees: { payer: "account" },
        requirement_collection: "stripe",
        stripe_dashboard: { type: "express" },
      },
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      business_type: "individual",
      metadata: { verifyScript: "true" },
    });
    console.log(`✅ Compte créé : ${account.id}`);
  } catch (e) {
    console.error(`\n⛔ Stripe REFUSE la combinaison : ${e.message}\n`);
    console.error(
      "   C'était le point incertain. Reprendre la table des combinaisons\n" +
        "   non supportées avant de toucher à stripe.connect.js.\n",
    );
    process.exit(1);
  }

  console.log("\n── Propriétés effectives ──\n");
  let ok = true;
  for (const [path, expected] of Object.entries(TARGET)) {
    const actual = get(account, path);
    const good = actual === expected;
    if (!good) ok = false;
    console.log(
      `${good ? "✅" : "❌"} ${path} = ${actual}${good ? "" : `  (attendu : ${expected})`}`,
    );
  }
  console.log(`\n   type = ${account.type}  (« none » est attendu et normal)`);

  console.log("\n── Lien d'onboarding ──\n");
  try {
    const link = await stripe.accountLinks.create({
      account: account.id,
      refresh_url: "https://birthreminder.com/stripe/refresh",
      return_url: "https://birthreminder.com/stripe/return",
      type: "account_onboarding",
    });
    console.log(`✅ Lien généré : ${link.url.slice(0, 60)}…`);
  } catch (e) {
    ok = false;
    console.log(`❌ Lien impossible : ${e.message}`);
  }

  console.log("\n────────────────────────────────────────────────────────");
  if (ok) {
    console.log(
      "✅ Configuration valide. La perte irrécouvrable est portée par Stripe.",
    );
  } else {
    console.log("❌ Configuration à revoir avant de modifier la production.");
  }

  console.log(
    "\n⚠️  RESTE À VÉRIFIER À LA MAIN, et ce n'est pas optionnel :\n" +
      "\n" +
      "   Terminer l'onboarding de ce compte de test, passer une contribution\n" +
      "   avec la carte 4242…, puis vérifier en base que `feeCents` est bien\n" +
      "   renseigné sur la contribution.\n" +
      "\n" +
      "   Pourquoi : `fees.payer` passe de `application_express` à `account`,\n" +
      "   et Stripe signale une variation du comportement de facturation en\n" +
      "   charges directes. Notre webhook lit `balance_transaction.fee` sur le\n" +
      "   compte de l'organisateur pour figer ce champ. S'il revient vide, rien\n" +
      "   ne casse visiblement — mais le coût de remboursement affiché à\n" +
      "   l'organisateur retombe sur une estimation, avant une opération\n" +
      "   irréversible. C'est le seul vrai risque de cette migration.\n",
  );

  console.log(`   Compte de test à supprimer ensuite : ${account.id}\n`);
})();
