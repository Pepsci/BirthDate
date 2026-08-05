const User = require("../models/user.model");

/**
 * Modération — helpers de blocage.
 *
 * `User.blockedUsers` doit être respecté dans les DEUX sens : que ce soit moi
 * qui aie bloqué l'autre ou l'inverse, aucune mise en relation ne doit pouvoir
 * s'établir. Avant ce module, le champ n'était lu qu'à un seul endroit
 * (GET /conversations, pour masquer les fils), ce qui rendait le blocage
 * largement cosmétique.
 *
 * Règle d'exposition : quand une action est refusée pour cause de blocage, les
 * routes renvoient le même message qu'un utilisateur introuvable. Sinon il
 * suffirait de comparer les erreurs pour découvrir qui vous a bloqué.
 */

/** Vrai si l'un des deux utilisateurs a bloqué l'autre. */
async function isBlockedBetween(userAId, userBId) {
  if (!userAId || !userBId) return false;
  const a = String(userAId);
  const b = String(userBId);
  if (a === b) return false;

  // Une seule requête : on cherche l'un OU l'autre sens.
  const hit = await User.findOne({
    $or: [
      { _id: a, blockedUsers: b },
      { _id: b, blockedUsers: a },
    ],
  })
    .select("_id")
    .lean();

  return !!hit;
}

/**
 * Parmi une liste d'utilisateurs, renvoie ceux qui sont en situation de
 * blocage avec `userId` (dans un sens ou dans l'autre). Utile pour filtrer un
 * envoi groupé (invitations d'événement) sans faire N requêtes.
 */
async function filterBlockedIds(userId, otherIds = []) {
  const me = String(userId);
  const others = [...new Set(otherIds.map(String))].filter((id) => id !== me);
  if (others.length === 0) return new Set();

  const [meDoc, blockers] = await Promise.all([
    User.findById(me).select("blockedUsers").lean(),
    User.find({ _id: { $in: others }, blockedUsers: me }).select("_id").lean(),
  ]);

  const blocked = new Set(
    (meDoc?.blockedUsers || []).map(String).filter((id) => others.includes(id)),
  );
  blockers.forEach((u) => blocked.add(String(u._id)));
  return blocked;
}

module.exports = { isBlockedBetween, filterBlockedIds };
