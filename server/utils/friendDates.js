const DateModel = require("../models/date.model");

// findOne + create séparés laissaient une fenêtre de course : si la route
// d'acceptation d'ami est appelée deux fois pour la même paire (double clic,
// requête rejouée, deux onglets...), les deux appels peuvent passer le
// `findOne` avant qu'aucun des deux n'ait encore créé le document, et on se
// retrouve avec deux cartes "ami" identiques — donc, plus tard, deux
// rappels d'anniversaire bien distincts (chacun avec son propre _id) pour
// la même personne. `findOneAndUpdate` + upsert est atomique : peu importe
// combien de fois createFriendDates est appelée pour la même paire, une
// seule carte est créée.
async function upsertFriendDate(ownerId, friendId, friend) {
  if (!friend.birthDate) return;

  // Cas fréquent : la carte existe déjà, ajoutée à la main AVANT que la
  // demande d'ami soit acceptée (on connaît la date d'anniversaire de son
  // ami avant même qu'il ait un compte). Le check ci-dessus ne la trouve
  // jamais puisqu'elle n'a pas encore de `linkedUser` — donc une DEUXIÈME
  // carte se créait à côté, identique en apparence (même nom, même date),
  // mais avec son propre _id : deux rappels séparés à chaque anniversaire.
  // On récupère cette carte manuelle existante et on la relie au lieu d'en
  // créer une nouvelle — ça garde aussi la photo/les cadeaux déjà dessus.
  const sameDay = new Date(friend.birthDate);
  const existingManual = await DateModel.findOne({
    owner: ownerId,
    linkedUser: null,
    name: new RegExp(`^${escapeRegExp(friend.name || "")}$`, "i"),
    $expr: {
      $and: [
        { $eq: [{ $dayOfMonth: "$date" }, sameDay.getUTCDate()] },
        { $eq: [{ $month: "$date" }, sameDay.getUTCMonth() + 1] },
      ],
    },
  });

  if (existingManual) {
    if (!existingManual.linkedUser) {
      existingManual.linkedUser = friendId;
      await existingManual.save();
    }
    return;
  }

  await DateModel.findOneAndUpdate(
    { owner: ownerId, linkedUser: friendId },
    {
      $setOnInsert: {
        date: friend.birthDate,
        name: friend.name,
        surname: friend.surname || "",
        owner: ownerId,
        linkedUser: friendId,
        family: false,
        receiveNotifications: true,
        notificationPreferences: { timings: [1], notifyOnBirthday: true },
        comment: [],
        gifts: [],
      },
    },
    { upsert: true, setDefaultsOnInsert: true },
  );
}

function escapeRegExp(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function createFriendDates(user1, user2) {
  await upsertFriendDate(user1._id, user2._id, user2);
  await upsertFriendDate(user2._id, user1._id, user1);
}

module.exports = { createFriendDates };
