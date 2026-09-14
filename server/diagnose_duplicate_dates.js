// Script de diagnostic ponctuel — à lancer toi-même dans un terminal normal
// (`node diagnose_duplicate_dates.js` depuis server/), PAS depuis mon
// bac à sable : je n'ai pas accès réseau à Mongo Atlas d'ici (SRV DNS
// bloqué), donc je ne peux pas l'exécuter pour toi.
//
// But : vérifier si les notifs d'anniversaire en double viennent de deux
// VRAIES cartes distinctes en base (donc deux _id différents, deux rappels
// parfaitement légitimes du point de vue du cron) plutôt que d'un bug dans
// le cron lui-même — auquel cas mon correctif d'idempotence (ReminderClaim,
// keyé par carte) n'y changerait rien puisque chaque carte a son propre
// verrou.
//
// Une fois que tu as le résultat, supprime ce fichier (ou dis-le moi, je
// m'en charge) — il n'a pas vocation à rester dans le repo.
require("dotenv").config();
const mongoose = require("mongoose");

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  const DateModel = require("./models/date.model");

  // 1) Cartes "ami" en double : même owner + même linkedUser.
  const linkedDupes = await DateModel.aggregate([
    { $match: { linkedUser: { $ne: null } } },
    {
      $group: {
        _id: { owner: "$owner", linkedUser: "$linkedUser" },
        count: { $sum: 1 },
        ids: { $push: "$_id" },
      },
    },
    { $match: { count: { $gt: 1 } } },
  ]);
  console.log(
    `Doublons owner+linkedUser (carte ami dupliquée) : ${linkedDupes.length}`,
  );
  console.log(JSON.stringify(linkedDupes, null, 2));

  // 2) Cartes manuelles en double : même owner + même nom + même date.
  const nameDupes = await DateModel.aggregate([
    {
      $group: {
        _id: { owner: "$owner", name: "$name", date: "$date" },
        count: { $sum: 1 },
        ids: { $push: "$_id" },
      },
    },
    { $match: { count: { $gt: 1 } } },
  ]);
  console.log(`\nDoublons owner+name+date (carte manuelle dupliquée) : ${nameDupes.length}`);
  console.log(JSON.stringify(nameDupes, null, 2));

  // 3) Toutes les cartes "Louise", pour inspection directe du cas signalé.
  const louise = await DateModel.find({ name: /louise/i }).lean();
  console.log(`\nCartes "Louise" trouvées : ${louise.length}`);
  console.log(JSON.stringify(louise, null, 2));

  await mongoose.disconnect();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
