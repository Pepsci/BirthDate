// scripts/reset-connect-account.js
//
// Supprime le compte connecté d'un utilisateur — chez Stripe ET en base — pour
// qu'il puisse se ré-onboarder avec la configuration actuelle du code.
//
// ⚠️ Pourquoi les deux, et pas seulement Stripe.
//
// `stripe.connect.js` fait `StripeAccount.findOne({ user })` avant toute
// création : tant que la ligne existe en base, la route réutilise l'ancien
// identifiant et ne crée jamais de nouveau compte. Supprimer uniquement côté
// Stripe donne donc l'impression que rien ne fonctionne, avec en prime un
// identifiant mort en base.
//
// ⚠️ Pourquoi ce script existe tout court : les propriétés de contrôle d'un
// compte connecté (`controller.losses.payments`, le type de tableau de bord)
// sont IMMUABLES. Changer la configuration dans le code ne rattrape aucun
// compte déjà créé — le seul moyen est d'en créer un nouveau.
//
// ⚠️ ORDRE : déployer le code AVANT de lancer ce script. Sinon le compte
// recréé le sera avec l'ancienne configuration, et il faudra recommencer.
//
// Ce script ne touche évidemment PAS au compte de plateforme BirthReminder.
//
// Usage : node scripts/reset-connect-account.js <email> [options]
//
//   --payout      Vide d'abord le solde vers le compte bancaire de
//                 l'organisateur, puis supprime. Stripe refuse la suppression
//                 d'un compte au solde non nul ; un reliquat de test doit donc
//                 être balayé avant. Peut échouer si le montant est sous le
//                 minimum de virement de Stripe — utiliser --local-only alors.
//
//   --local-only  Ne supprime QUE la ligne en base, laisse le compte chez
//                 Stripe. C'est souvent le bon choix : l'objectif est d'obtenir
//                 un NOUVEAU compte à la bonne configuration, pas de détruire
//                 l'ancien. Le compte orphelin reste inoffensif — il n'est plus
//                 rattaché à personne dans l'application.
//
//   --yes         Sans confirmation interactive.

require("dotenv").config();
const readline = require("readline");
const mongoose = require("mongoose");
const stripe = require("../config/stripe.config");
const User = require("../models/user.model");
const StripeAccount = require("../models/stripeAccount.model");
const GiftPoolContribution = require("../models/giftPoolContribution.model");
const Event = require("../models/event.model");

const email = process.argv[2];
const auto = process.argv.includes("--yes");
const doPayout = process.argv.includes("--payout");
const localOnly = process.argv.includes("--local-only");

if (!email) {
  console.error("\nUsage : node scripts/reset-connect-account.js <email> [--yes]\n");
  process.exit(1);
}

const ask = (q) =>
  new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question(q, (a) => {
      rl.close();
      resolve(a.trim().toLowerCase());
    });
  });

(async () => {
  await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI);

  const user = await User.findOne({ email: email.toLowerCase() }).select(
    "name surname email",
  );
  if (!user) {
    console.error(`\n❌ Aucun utilisateur avec l'email ${email}\n`);
    await mongoose.disconnect();
    process.exit(1);
  }

  const record = await StripeAccount.findOne({ user: user._id });
  if (!record) {
    console.log(
      `\n✅ ${user.email} n'a aucun compte connecté en base. Rien à faire :` +
        ` le prochain onboarding créera un compte avec la configuration actuelle.\n`,
    );
    await mongoose.disconnect();
    return;
  }

  console.log(`\nUtilisateur   : ${user.name} ${user.surname || ""} (${user.email})`);
  console.log(`Compte Stripe : ${record.stripeAccountId}`);

  // ⚠️ Deux lectures DISTINCTES, et deux échecs qui ne veulent pas dire la
  // même chose. Les mélanger dans un seul try/catch faisait afficher « compte
  // illisible, peut-être déjà supprimé » alors que le compte se lisait très
  // bien et que seul le solde avait échoué.
  let accountExists = true;
  try {
    const acct = await stripe.accounts.retrieve(record.stripeAccountId);
    console.log(
      `Configuration : pertes=${acct.controller?.losses?.payments ?? "?"}` +
        `  dashboard=${acct.controller?.stripe_dashboard?.type ?? "?"}` +
        `  type=${acct.type || "none"}`,
    );
  } catch (e) {
    accountExists = false;
    console.log(`⚠️  Compte introuvable chez Stripe : ${e.message}`);
    console.log("   Il a sans doute déjà été supprimé — la ligne en base, non.");
  }

  // Solde : lu seulement si le compte existe encore.
  //
  // ⚠️ Un solde ILLISIBLE n'est pas un solde nul. Supprimer un compte dont on
  // ignore le solde, c'est risquer de couper l'accès à de l'argent qui
  // appartient à des contributeurs. Dans le doute, on s'arrête.
  if (accountExists) {
    let balanceCents = null;
    try {
      const balance = await stripe.balance.retrieve(
        {},
        { stripeAccount: record.stripeAccountId },
      );
      balanceCents = [...(balance.available || []), ...(balance.pending || [])]
        .filter((b) => b.currency === "eur")
        .reduce((t, b) => t + b.amount, 0);
      console.log(`Solde         : ${(balanceCents / 100).toFixed(2)} €`);
    } catch (e) {
      console.error(`\n⛔ Solde illisible : ${e.message}`);
      console.error(
        "   On ne supprime pas un compte dont on ignore le solde.\n" +
          "   Vérifie-le dans le dashboard Stripe, puis relance.\n",
      );
      await mongoose.disconnect();
      process.exit(1);
    }

    if (balanceCents > 0 && !localOnly) {
      if (!doPayout) {
        console.error(
          `\n⛔ Solde non nul. Stripe refuse de supprimer un compte connecté` +
            ` qui détient encore de l'argent.\n\n` +
            `   Deux sorties :\n` +
            `     --payout      vide le solde vers le compte bancaire, puis supprime\n` +
            `     --local-only  laisse le compte chez Stripe, ne retire que la ligne\n` +
            `                   en base — suffisant pour se ré-onboarder à neuf\n`,
        );
        await mongoose.disconnect();
        process.exit(1);
      }

      // Balayage du reliquat avant suppression.
      //
      // ⚠️ Ne jamais faire ça sur un compte qui détient des contributions
      // vivantes : le contrôle plus bas s'en charge, mais l'ordre compte.
      // Ici on ne balaie qu'un solde résiduel de test.
      console.log(`\nBalayage de ${(balanceCents / 100).toFixed(2)} € vers la banque…`);
      try {
        const payout = await stripe.payouts.create(
          { amount: balanceCents, currency: "eur" },
          { stripeAccount: record.stripeAccountId },
        );
        console.log(`✅ Virement créé : ${payout.id}`);
        console.log(
          "   ⚠️  Le solde ne tombe à zéro qu'une fois le virement PAYÉ." +
            " Comptez quelques jours ouvrés, puis relancez ce script.\n",
        );
        await mongoose.disconnect();
        return;
      } catch (e) {
        console.error(`\n⛔ Virement impossible : ${e.message}`);
        console.error(
          "   Souvent parce que le montant est sous le minimum de virement" +
            " de Stripe.\n   Utilise --local-only : le compte reste chez Stripe," +
            " mais l'application\n   en créera un neuf au prochain onboarding.\n",
        );
        await mongoose.disconnect();
        process.exit(1);
      }
    }

    if (balanceCents > 0 && localOnly) {
      console.log(
        `ℹ️  Solde de ${(balanceCents / 100).toFixed(2)} € laissé sur le compte` +
          ` Stripe, qui n'est pas supprimé.`,
      );
    }
  }

  const events = await Event.find({ organizer: user._id }).select("_id");
  const live = await GiftPoolContribution.countDocuments({
    event: { $in: events.map((e) => e._id) },
    status: "succeeded",
  });
  if (live > 0) {
    console.error(
      `\n⛔ ${live} contribution(s) encaissée(s) et non remboursée(s) sur les` +
        ` cagnottes de cet utilisateur. Supprimer le compte connecté rendrait` +
        ` tout remboursement impossible.\n`,
    );
    await mongoose.disconnect();
    process.exit(1);
  }

  if (!auto) {
    const answer = await ask(
      localOnly
        ? "\nRetirer la ligne en base et laisser le compte chez Stripe ? (oui/non) "
        : "\nSupprimer ce compte connecté chez Stripe et en base ? (oui/non) ",
    );
    if (answer !== "oui" && answer !== "o") {
      console.log("Annulé.\n");
      await mongoose.disconnect();
      return;
    }
  }

  if (localOnly) {
    console.log(
      `ℹ️  Compte ${record.stripeAccountId} conservé chez Stripe (--local-only).`,
    );
  } else if (accountExists) {
    try {
      await stripe.accounts.del(record.stripeAccountId);
      console.log(`✅ Supprimé chez Stripe : ${record.stripeAccountId}`);
    } catch (e) {
      console.log(`⚠️  Suppression Stripe impossible : ${e.message}`);
      console.log(
        "   On retire quand même la ligne en base pour débloquer l'onboarding.",
      );
    }
  }

  await StripeAccount.deleteOne({ _id: record._id });
  console.log("✅ Ligne StripeAccount supprimée en base.");

  console.log(
    `\n👉 ${user.email} peut maintenant se ré-onboarder depuis l'application.` +
      `\n   Vérifie ensuite avec : node scripts/check-connect-liability.js\n`,
  );

  await mongoose.disconnect();
})();
