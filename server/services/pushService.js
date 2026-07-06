const webpush = require("web-push");
const PushSubscription = require("../models/PushSubscription.model");

// 👇 Lazy init — évite le crash au require si VAPID pas encore chargé
let vapidInitialized = false;

function initVapid() {
  if (vapidInitialized) return true;
  if (
    !process.env.VAPID_MAILTO ||
    !process.env.VAPID_PUBLIC_KEY ||
    !process.env.VAPID_PRIVATE_KEY
  ) {
    console.warn("⚠️ VAPID non configuré — push notifications désactivées");
    return false;
  }
  webpush.setVapidDetails(
    process.env.VAPID_MAILTO,
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  );
  vapidInitialized = true;
  return true;
}

/**
 * Envoie une push notification à un utilisateur (tous ses appareils)
 * @param {ObjectId} userId
 * @param {Object} payload  { title, body, icon, url, tag, type, friendId }
 *   type: "chat" | "birthday" | "friend" | "gift" | "default"
 */
async function sendPushToUser(userId, payload) {
  // Push natif mobile (Expo) — indépendant du web push, jamais bloquant
  sendExpoPushToUser(userId, payload).catch((err) =>
    console.error("[ExpoPush] error:", err.message),
  );

  if (!initVapid()) return; // Skip silencieux si VAPID pas configuré

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

/**
 * Envoie une notification native (iOS/Android) via l'API Expo Push.
 * Les credentials FCM/APNs sont gérés côté Expo (eas credentials),
 * le backend n'a besoin d'aucune clé.
 */
async function sendExpoPushToUser(userId, payload) {
  const User = require("../models/user.model");
  const axios = require("axios");

  const user = await User.findById(userId).select("expoPushTokens");
  const tokens = user?.expoPushTokens || [];
  if (!tokens.length) return;

  const messages = tokens.map((to) => ({
    to,
    title: payload.title || "BirthReminder",
    body: payload.body || "",
    sound: "default",
    data: {
      url: payload.url || "/home",
      type: payload.type || "default",
      friendId: payload.friendId || null,
    },
  }));

  const { data } = await axios.post(
    "https://exp.host/--/api/v2/push/send",
    messages,
    { headers: { "Content-Type": "application/json" }, timeout: 10000 },
  );

  // Nettoyage des tokens invalides (app désinstallée, etc.)
  const tickets = data?.data || [];
  const deadTokens = [];
  tickets.forEach((ticket, i) => {
    if (
      ticket.status === "error" &&
      ticket.details?.error === "DeviceNotRegistered"
    ) {
      deadTokens.push(tokens[i]);
    }
  });
  if (deadTokens.length) {
    await User.findByIdAndUpdate(userId, {
      $pull: { expoPushTokens: { $in: deadTokens } },
    });
    console.log(`[ExpoPush] ${deadTokens.length} token(s) mort(s) supprimé(s)`);
  }

  const ok = tickets.filter((t) => t.status === "ok").length;
  console.log(`[ExpoPush] userId=${userId} → ${ok}/${tokens.length} envoyées`);
}

module.exports = { sendPushToUser, sendExpoPushToUser };
