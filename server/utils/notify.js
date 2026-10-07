const Notification = require("../models/notification.model");
const User = require("../models/user.model");
const { sendPushToUser } = require("../services/pushService");
const { REACTION_PUSH_GLYPH } = require("../constants/reactions");
const { translator, getUserLanguage, resolveText } = require("../i18n");

/**
 * Certains champs de `data` sont des phrases composées par le serveur
 * (`message`, `statusLabel`, `newDateLabel`…) et affichées telles quelles par
 * le centre de notifications. L'appelant peut les donner sous forme de
 * fonction `(L) => L("cle", { … })` : elles sont résolues ici, dans la langue
 * du destinataire, avant l'enregistrement. Les autres valeurs ne bougent pas.
 */
async function localizeData(userId, data) {
  const keys = Object.keys(data || {}).filter(
    (k) => typeof data[k] === "function",
  );
  if (keys.length === 0) return data;
  const L = translator(await getUserLanguage(userId));
  const out = { ...data };
  for (const k of keys) out[k] = resolveText(data[k], L);
  return out;
}

/**
 * Crée une notification en base et l'émet en temps réel via Socket.io.
 * Envoie également une push notification si l'utilisateur l'a activée.
 * - "new_message" : déduplique par conversationId
 * - "event_chat_message" : déduplique par eventShortId
 * - "message_reaction" : déduplique par messageId
 *
 * @param {Express.Application} app
 * @param {Object} opts
 * @param {string} opts.userId
 * @param {string} opts.type
 * @param {Object} opts.data
 * @param {string} opts.link
 */
const notify = async (app, { userId, type, data = {}, link = null }) => {
  let notif;
  data = await localizeData(userId, data);

  // Déduplication messages DM : une seule notif non lue par conversation
  if (type === "new_message" && data.conversationId) {
    const existing = await Notification.findOne({
      userId,
      type: "new_message",
      read: false,
      "data.conversationId": data.conversationId,
    });

    if (existing) {
      existing.data = data;
      existing.link = link;
      existing.createdAt = new Date();
      await existing.save();
      notif = existing;
    }
  }

  // Déduplication messages event : une seule notif non lue par event
  if (type === "event_chat_message" && data.eventShortId) {
    const existing = await Notification.findOne({
      userId,
      type: "event_chat_message",
      read: false,
      "data.eventShortId": data.eventShortId,
    });

    if (existing) {
      existing.data = data;
      existing.link = link;
      existing.createdAt = new Date();
      await existing.save();
      notif = existing;
    }
  }

  /*
   * Déduplication des réactions : une seule notif non lue par message.
   *
   * ⚠️ Sans ça, un message d'événement que douze personnes aiment produit
   * douze lignes dans le centre de notifications : et douze pushes. La
   * dernière réaction écrase la précédente : on garde « quelqu'un a réagi à ce
   * message », qui est l'information utile, sans l'empilement.
   */
  if (type === "message_reaction" && data.messageId) {
    const existing = await Notification.findOne({
      userId,
      type: "message_reaction",
      read: false,
      "data.messageId": data.messageId,
    });

    if (existing) {
      existing.data = data;
      existing.link = link;
      existing.createdAt = new Date();
      await existing.save();
      notif = existing;
    }
  }

  if (!notif) {
    notif = await Notification.create({ userId, type, data, link });
  }

  // Émission Socket.io in-app
  const io = app?.get("io");
  if (io) {
    io.to(`user:${userId}`).emit("new_notification", {
      _id: notif._id,
      type: notif.type,
      data: notif.data,
      link: notif.link,
      read: false,
      createdAt: notif.createdAt,
    });
  }

  // Push notification pour event_chat_message
  if (type === "event_chat_message") {
    try {
      const user = await User.findById(userId).select("pushEnabled pushEvents");
      if (user?.pushEnabled && user?.pushEvents?.events) {
        await sendPushToUser(userId, {
          title: (L) => `💬 ${data.eventTitle || L("push.eventWord")}`,
          body: (L) =>
            `${data.senderName} : ${data.preview || L("push.newMessage")}`,
          url: `${process.env.FRONTEND_URL}${link || "/"}`,
          tag: `event-chat-${data.eventShortId}`,
          // Idem pour la discussion d'un événement : le silencieux vise CET
          // événement, pas la catégorie « événements » entière.
          muteScope: { kind: "event", id: data.eventShortId },
          type: "events",
        });
      }
    } catch (pushErr) {
      console.error("❌ Push event_chat_message failed:", pushErr);
    }
  }

  // Push notification pour event_pool_contribution
  if (type === "event_pool_contribution") {
    try {
      const user = await User.findById(userId).select("pushEnabled pushEvents");
      if (user?.pushEnabled && user?.pushEvents?.events) {
        await sendPushToUser(userId, {
          title: (L) =>
            L("push.pool.contributionTitle", {
              title: data.eventTitle || L("push.pool.pool"),
            }),
          body: (L) =>
            L("push.pool.contributionBody", {
              name: data.contributorName,
              amount: data.amountLabel || "",
            }),
          url: `${process.env.FRONTEND_URL}${link || "/"}`,
          tag: `event-pool-${data.eventShortId}`,
          type: "events",
        });
      }
    } catch (pushErr) {
      console.error("❌ Push event_pool_contribution failed:", pushErr);
    }
  }

  /*
   * Push réaction.
   *
   * ⚠️ Le tag est propre à la réaction (`reaction-<messageId>`) et non à la
   * conversation : sinon une réaction remplacerait sur l'écran verrouillé la
   * notification d'un message pas encore lu.
   *
   * Aucun extrait du message : les contenus sont chiffrés de bout en bout et
   * le serveur ne peut pas les lire : il n'a d'ailleurs pas à le pouvoir.
   * « Pierre a réagi ❤️ à votre message » dit tout ce qu'il faut.
   *
   * `sendPushToUser` applique seul `pushEnabled`, la catégorie et le mode
   * silencieux de CETTE conversation : rien à revérifier ici.
   */
  if (type === "message_reaction") {
    try {
      const glyph = REACTION_PUSH_GLYPH[data.reaction] || "";
      const isEvent = Boolean(data.eventShortId);

      await sendPushToUser(userId, {
        title: (L) =>
          isEvent
            ? `${glyph} ${data.eventTitle || L("push.eventWord")}`
            : `${glyph} ${data.reactorName || L("push.someone")}`,
        body: (L) =>
          isEvent
            ? L("push.reaction.inEvent", {
                name: data.reactorName || L("push.someone"),
              })
            : L("push.reaction.dm"),
        url: `${process.env.FRONTEND_URL}${link || "/"}`,
        tag: `reaction-${data.messageId}`,
        muteScope: isEvent
          ? { kind: "event", id: data.eventShortId }
          : { kind: "dm", id: data.conversationId },
        type: isEvent ? "events" : "chat",
      });
    } catch (pushErr) {
      console.error("❌ Push message_reaction failed:", pushErr);
    }
  }

  /*
   * Push réponse du support.
   *
   * Sans elle, un utilisateur mobile ne savait pas qu'on lui avait répondu :
   * la notification restait dans le centre in-app. Pas de catégorie
   * `pushEvents` : on ne coupe pas la réponse à une demande qu'on a soi-même
   * faite. Seul `pushEnabled` s'applique (dans sendPushToUser).
   */
  if (type === "support_reply") {
    try {
      await sendPushToUser(userId, {
        title: (L) => L("push.supportReply"),
        body: data.subject || "",
        url: `${process.env.FRONTEND_URL}${link || "/home?tab=support"}`,
        tag: `support-${data.ticketId}`,
        type: "support",
      });
    } catch (pushErr) {
      console.error("❌ Push support_reply failed:", pushErr);
    }
  }

  return notif;
};

module.exports = { notify };
