const webpush = require("web-push");
const PushSubscription = require("../models/PushSubscription.model");

webpush.setVapidDetails(
  process.env.VAPID_MAILTO,
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY,
);

/**
 * Envoie une push notification à un utilisateur (tous ses appareils)
 * @param {ObjectId} userId
 * @param {Object} payload  { title, body, icon, url, tag, type, friendId }
 *   type: "chat" | "birthday" | "friend" | "gift" | "default"
 */
async function sendPushToUser(userId, payload) {
  const subs = await PushSubscription.find({ user: userId });
  if (!subs.length) return;

  const message = JSON.stringify({
    title: payload.title || "BirthReminder",
    body: payload.body || "",
    icon: payload.icon || "/icon-192x192.png",
    badge: "/badge-72x72.png",
    url: payload.url || "/home",
    tag: payload.tag || "birthreminder-default",
    type: payload.type || "default",
    friendId: payload.friendId || null,
  });

  const results = await Promise.allSettled(
    subs.map((sub) =>
      webpush.sendNotification(sub.subscription, message).catch(async (err) => {
        // Subscription expirée ou invalide → on la supprime
        if (err.statusCode === 410 || err.statusCode === 404) {
          await PushSubscription.deleteOne({ _id: sub._id });
        }
        throw err;
      }),
    ),
  );

  const sent = results.filter((r) => r.status === "fulfilled").length;
  const failed = results.filter((r) => r.status === "rejected").length;
  console.log(`[Push] userId=${userId} → ${sent} envoyées, ${failed} échouées`);
}

module.exports = { sendPushToUser };
