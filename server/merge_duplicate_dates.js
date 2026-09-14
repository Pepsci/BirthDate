// Script ponctuel — à lancer toi-même (`node merge_duplicate_dates.js`),
// je n'ai pas accès réseau à Mongo depuis mon bac à sable.
//
// Par défaut : DRY RUN, n'écrit rien, affiche juste ce qu'il ferait pour
// chaque paire de cartes "owner+name+date" en double détectées par
// diagnose_duplicate_dates.js. Une fois que le résultat te semble correct,
// relance avec --apply pour appliquer réellement la fusion :
//
//   node merge_duplicate_dates.js          # aperçu, ne touche à rien
//   node merge_duplicate_dates.js --apply  # fusionne pour de vrai
//
// Règle de fusion, par paire :
// - la carte "gagnante" est celle qui a un linkedUser (carte liée à un ami
//   inscrit) ; si aucune des deux n'en a, celle avec une photo ; sinon la
//   plus ancienne (_id le plus petit).
// - les cadeaux (`gifts`) des deux cartes sont fusionnés sur la gagnante
//   (union, sans doublons par giftName).
// - la photo de la perdante est reprise si la gagnante n'en a pas.
// - la carte perdante est ensuite supprimée.
//
// Rien n'est irréversible tant que --apply n'est pas passé.
require("dotenv").config();
const mongoose = require("mongoose");

const APPLY = process.argv.includes("--apply");

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  const DateModel = require("./models/date.model");

  const dupes = await DateModel.aggregate([
    {
      $group: {
        _id: { owner: "$owner", name: "$name", date: "$date" },
        count: { $sum: 1 },
        ids: { $push: "$_id" },
      },
    },
    { $match: { count: { $gt: 1 } } },
  ]);

  console.log(`${dupes.length} paire(s) en double trouvée(s).\n`);

  for (const dupe of dupes) {
    const docs = await DateModel.find({ _id: { $in: dupe.ids } });
    if (docs.length !== 2) {
      console.log(`⚠️  ${dupe._id.name} (owner ${dupe._id.owner}) : ${docs.length} cartes, pas 2 — ignoré, à traiter à la main.`);
      continue;
    }
    const [a, b] = docs;

    const score = (d) => (d.linkedUser ? 2 : 0) + (d.photo ? 1 : 0);
    let winner = score(a) >= score(b) ? a : b;
    let loser = winner === a ? b : a;
    if (score(a) === score(b)) {
      // égalité : garde la plus ancienne
      winner = a._id.toString() < b._id.toString() ? a : b;
      loser = winner === a ? b : a;
    }

    console.log(`— ${dupe._id.name} (owner ${dupe._id.owner}) —`);
    console.log(`  garde  : ${winner._id}  linkedUser=${winner.linkedUser || "-"} photo=${winner.photo ? "oui" : "non"} gifts=${winner.gifts.length}`);
    console.log(`  fusion : ${loser._id}  linkedUser=${loser.linkedUser || "-"} photo=${loser.photo ? "oui" : "non"} gifts=${loser.gifts.length}`);

    if (APPLY) {
      const existingNames = new Set(winner.gifts.map((g) => g.giftName));
      for (const g of loser.gifts) {
        if (!existingNames.has(g.giftName)) {
          winner.gifts.push(g.toObject ? g.toObject() : g);
        }
      }
      if (!winner.photo && loser.photo) winner.photo = loser.photo;
      await winner.save();
      await DateModel.deleteOne({ _id: loser._id });
      console.log(`  ✅ fusionné, ${loser._id} supprimée.`);
    }
    console.log("");
  }

  if (!APPLY) {
    console.log("Aperçu seulement — rien n'a été modifié. Relance avec --apply pour appliquer.");
  }

  await mongoose.disconnect();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
