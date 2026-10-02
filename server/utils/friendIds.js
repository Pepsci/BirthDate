// utils/friendIds.js
//
// Identifiants (chaînes) des amis acceptés d'un utilisateur.
// Version légère de Friend.getFriends() : aucun populate, pour les contrôles
// d'accès et la présence en ligne, appelés souvent.

const Friend = require("../models/friend.model");

async function friendIdsOf(userId) {
  const me = String(userId);
  const friendships = await Friend.find({
    $or: [
      { user: me, status: "accepted" },
      { friend: me, status: "accepted" },
    ],
  })
    .select("user friend")
    .lean();
  return friendships.map((f) =>
    String(f.user) === me ? String(f.friend) : String(f.user),
  );
}

module.exports = { friendIdsOf };
