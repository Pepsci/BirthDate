const webpush = require("web-push");
const PushSubscription = require("../models/PushSubscription.model");

/**
 * Nombre total d'éléments non lus pour un utilisateur (messages chat +
 * notifications in-app). Utilisé pour poser le badge sur l'icône de l'app
 * mobile (champ `badge` du payload Expo Push — pris en compte par iOS/Android
 * même quand l'app est fermée, contrairement à `shouldSetBadge` côté client
 * qui ne s'applique qu'à l'app au premier plan).
 */
async function getBadgeCountForUser(userId) {
  try {
    const Conversation = require("../models/conversation.model");
    const Message = require("../models/message.model");
    const Notification = require("../models/notification.model");

    const conversations = await Conversation.find({
      participants: userId,
    }).select("_id");
    const conversationIds = conversations.map((c) => c._id);

    const [unreadMessages, unreadNotifs] = await Promise.all([
      conversationIds.length
        ? Message.countDocuments({
            conversation: { $in: conversationIds },
            sender: { $ne: userId },
            "readBy.user": { $ne: userId },
          })
        : 0,
      Notification.countDocuments({ userId, read: false }),
    ]);

    return unreadMessages + unreadNotifs;
  } catch (err) {
    console.error("[Push] Erreur calcul badge count:", err.message);
    return 0;
  }
}

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
  // `webOnly: true` = uniquement web push (ex : récap "messages non lus" du cron,
  // redondant sur mobile où chaque message a déjà sa propre notification)
  if (!payload.webOnly) {
    sendExpoPushToUser(userId, payload).catch((err) =>
      console.error("[ExpoPush] error:", err.message),
    );
  }

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
 * `payload.type` (vocabulaire des appelants) → catégorie `user.pushEvents`
 * (vocabulaire de l'écran Réglages > Notifications de l'app mobile).
 * Un type absent de cette table n'est rattaché à aucune catégorie : il passe
 * dès lors que `pushEnabled` est vrai (cas de "default").
 */
const PUSH_CATEGORY_BY_TYPE = {
  birthday: "birthdays",
  birthdays: "birthdays",
  nameday: "namedays",
  namedays: "namedays",
  chat: "chat",
  friend: "friends",
  friends: "friends",
  gift: "gifts",
  gifts: "gifts",
  shared_list: "sharedLists",
  event: "events",
  events: "events",
};

/**
 * Envoie une notification native (iOS/Android) via l'API Expo Push.
 * Les credentials FCM/APNs sont gérés côté Expo (eas credentials),
 * le backend n'a besoin d'aucune clé.
 *
 * ⚠️ C'est ICI qu'on applique `pushEnabled` / `pushEvents` — et nulle part
 * ailleurs. Les appelants étaient jusqu'ici libres de les vérifier ou non
 * (certains le faisaient, la plupart non), si bien que les interrupteurs de
 * l'écran Réglages n'avaient pratiquement aucun effet. La vérification est
 * volontairement limitée au push mobile : le web push a son propre canal
 * (PushSubscription) et n'est pas concerné par ces réglages.
 */
async function sendExpoPushToUser(userId, payload) {
  const User = require("../models/user.model");
  const axios = require("axios");

  const user = await User.findById(userId).select(
    "expoPushTokens expoPushTokensIos pushEnabled pushEvents",
  );
  const tokens = user?.expoPushTokens || [];
  if (!tokens.length) return;

  if (user.pushEnabled !== true) return;
  const category = PUSH_CATEGORY_BY_TYPE[payload.type];
  if (category && user.pushEvents?.[category] === false) return;
  const iosTokens = new Set(user?.expoPushTokensIos || []);
  const badgeCount = await getBadgeCountForUser(userId);

  const messages = tokens.map((to) => {
    const msg = {
      to,
      sound: "default",
      priority: "high",
      badge: badgeCount,
      data: {
        url: payload.url || "/home",
        type: payload.type || "default",
        friendId: payload.friendId || null,
        // Champs E2E (présents seulement pour les messages chiffrés) :
        // l'appareil déchiffre `cipher` localement et affiche une notif lisible.
        encrypted: payload.encrypted || false,
        cipher: payload.cipher || null, // = encryptedForRecipient
        senderPublicKey: payload.senderPublicKey || null,
        senderName: payload.senderName || null,
        conversationId: payload.conversationId || null,
        messageId: payload.messageId || null, // anti-doublon côté mobile
        tag: payload.tag || null,
      },
    };
    if (payload.dataOnly && !iosTokens.has(to)) {
      // Android : pas de title/body → rien affiché automatiquement, la tâche
      // de fond déchiffre et présente elle-même la notif lisible.
      msg._contentAvailable = true;
    } else {
      // iOS (et pushes classiques) : notif alerte — fiable à chaque message.
      // ⚠️ Les pushes silencieuses (_contentAvailable seul) sont throttlées par
      // iOS (~quelques réveils/h) → on affiche le fallback "🔒 Nouveau message
      // chiffré" à chaque message. mutableContent prépare la NSE (phase 2) qui
      // remplacera ce texte par le message déchiffré, façon WhatsApp.
      msg.title = payload.title || "BirthReminder";
      msg.body = payload.body || "";
      if (payload.dataOnly) msg.mutableContent = true;
    }
    return msg;
  });

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
