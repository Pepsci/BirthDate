// scripts/check-last-contributions.js
//
// Vérifie que `feeCents` se remplit bien après un paiement.
//
// ⚠️ C'est LE point qui peut échouer silencieusement après la bascule vers des
// comptes Standard. `fees.payer` passe à "account", et notre webhook lit les
// frais réels sur la `balance_transaction` de la charge, côté compte connecté.
// Si cette lecture ne renvoie plus rien, rien ne casse visiblement : le
// paiement passe, la cagnotte se met à jour. Mais le coût d'un remboursement
// affiché à l'organisateur retombe sur une estimation — un chiffre qui peut
// valoir la moitié de la réalité, montré juste avant une opération
// irréversible.
//
// Lecture seule. Usage : node scripts/check-last-contributions.js [nombre]

require("dotenv").config();
const mongoose = require("mongoose");
const GiftPoolContribution = require("../models/giftPoolContribution.model");
const Event = require("../models/event.model");

const limit = parseInt(process.argv[2]) || 5;

(async () => {
  await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI);

  const contributions = await GiftPoolContribution.find()
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  if (contributions.length === 0) {
    console.log("\nAucune contribution en base.\n");
    await mongoose.disconnect();
    return;
  }

  const events = await Event.find({
    _id: { $in: contributions.map((c) => c.event) },
  })
    .select("shortId title")
    .lean();
  const byId = {};
  events.forEach((e) => (byId[String(e._id)] = e));

  console.log(`\n${contributions.length} dernière(s) contribution(s) :\n`);

  let missing = 0;
  let pendingCount = 0;
  for (const c of contributions) {
    const ev = byId[String(c.event)];
    // ⚠️ Compter AUSSI les contributions remboursées.
    //
    // La première version ne comptait que le statut "succeeded". Une
    // contribution encaissée puis remboursée passe à "refunded" : elle
    // sortait donc du décompte, et le script annonçait « tout va bien » sur
    // un jeu de données où AUCUN frais n'était enregistré. Un vérificateur
    // qui valide un échec est pire que pas de vérificateur.
    //
    // Les "pending" restent exclus : le webhook n'est jamais passé dessus,
    // l'absence de frais y est normale — mais on les signale à part.
    const feeOk = typeof c.feeCents === "number";
    if (!feeOk && (c.status === "succeeded" || c.status === "refunded")) {
      missing += 1;
    }
    if (c.status === "pending") pendingCount += 1;

    console.log(
      `  ${c.createdAt.toISOString().slice(0, 16)}  ` +
        `${(c.amount / 100).toFixed(2)} €  ${c.status.padEnd(9)}  ` +
        `frais=${feeOk ? `${(c.feeCents / 100).toFixed(2)} €` : "❌ ABSENT"}  ` +
        `${ev ? ev.title : "(événement supprimé)"}`,
    );
    console.log(`     ${c.stripePaymentIntentId}`);
    if (c.guestEmail) console.log(`     invité : ${c.guestEmail}`);
    console.log(
      `     reçu envoyé : ${c.receiptSentAt ? c.receiptSentAt.toISOString().slice(0, 16) : "non"}`,
    );
  }

  console.log("\n── Verdict ──");
  if (missing > 0) {
    console.log(
      `❌ ${missing} contribution(s) encaissée(s) ou remboursée(s) SANS frais réels.\n\n` +
        "   Le webhook payment_intent.succeeded n'a pas pu lire la\n" +
        "   balance_transaction de la charge. Causes probables :\n" +
        "     - `event.account` absent : en local, les événements de compte\n" +
        "       connecté doivent être transmis avec leur contexte\n" +
        "       (stripe listen --forward-connect-to …) ;\n" +
        "     - la lecture est faite sans l'en-tête stripeAccount, donc sur\n" +
        "       le compte plateforme où la charge n'existe pas.\n\n" +
        "   Conséquence : le coût d'un remboursement montré à l'organisateur\n" +
        "   retombe sur une ESTIMATION, juste avant une action irréversible.\n" +
        "   Chercher « frais réels illisibles » dans les logs du serveur.\n",
    );
  } else {
    console.log(
      "✅ Les frais réels sont enregistrés : le coût d'un remboursement\n" +
        "   affiché à l'organisateur sera le vrai, pas une estimation.\n",
    );
  }

  if (pendingCount > 0) {
    console.log(
      `ℹ️  ${pendingCount} contribution(s) encore en « pending » : le webhook\n` +
        "   payment_intent.succeeded n'est jamais arrivé pour elles. Paiement\n" +
        "   abandonné, ou webhook non transmis au moment du test.\n",
    );
  }

  await mongoose.disconnect();
})();
