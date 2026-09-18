// deleteLinkedCards.js
//
// Supprime, chez TOUS les autres utilisateurs, les cartes anniversaire liées
// à un compte (champ `linkedUser`), ainsi que les cartes référencées par ses
// amitiés (`Friend.linkedDate`).
//
// ── Pourquoi ────────────────────────────────────────────────────────────────
// Retirer un ami supprime sa carte des deux côtés (routes/friends.js). La
// suppression de compte, elle, ne supprimait que les cartes DU compte et ses
// amitiés : les cartes que les autres avaient de lui restaient, avec un
// `linkedUser` vers un compte mort. Et comme DELETE /date/:id refuse toute
// carte liée (« Supprimez l'ami de votre liste… ») alors que l'ami n'est plus
// dans la liste, la carte devenait impossible à supprimer.
//
// ⚠️ À appeler AVANT Friend.deleteMany : on lit les `linkedDate` des amitiés.

const DateModel = require("../models/date.model");
const Friend = require("../models/friend.model");
const { removeCardPhotoFiles } = require("../config/cardPhotoStorage");

async function deleteLinkedCards(userId) {
  const friendships = await Friend.find({
    $or: [{ user: userId }, { friend: userId }],
    linkedDate: { $ne: null },
  }).select("linkedDate");

  const linkedDateIds = friendships.map((f) => f.linkedDate);

  const cards = await DateModel.find({
    $or: [{ linkedUser: userId }, { _id: { $in: linkedDateIds } }],
  }).select("_id photo");

  if (cards.length === 0) return 0;

  await DateModel.deleteMany({ _id: { $in: cards.map((c) => c._id) } });

  // Photos des cartes : best effort, un fichier manquant ne bloque rien.
  await Promise.all(
    cards
      .filter((c) => c.photo)
      .map((c) =>
        removeCardPhotoFiles(c._id).catch((err) =>
          console.error("Erreur suppression photo carte:", err.message),
        ),
      ),
  );

  return cards.length;
}

module.exports = { deleteLinkedCards };
