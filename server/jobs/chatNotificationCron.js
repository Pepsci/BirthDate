/**
 * chatNotificationCron.js
 *
 * Envoie des emails + push notifications pour les messages chat non lus.
 * Respecte les préférences de l'utilisateur :
 *   - receiveChatEmails (bool)          : activer/désactiver emails globalement
 *   - chatEmailFrequency                : "instant" | "twice_daily" | "daily" | "weekly"
 *   - chatEmailDisabledFriends          : [userId] — amis exclus de l'EMAIL uniquement (pas du push)
 *   - pushEnabled (bool)                : activer/désactiver push globalement
 *   - pushEvents.chat (bool)            : push pour les messages chat
 */

const cron = require("node-cron");
const nodemailer = require("nodemailer");
const { SESClient, SendRawEmailCommand } = require("@aws-sdk/client-ses");
const userModel = require("../models/user.model");
const Message = require("../models/message.model");
const Conversation = require("../models/conversation.model");
const { sendPushToUser } = require("../services/pushService");
const {
  buildUnsubscribeUrl,
  listUnsubscribeHeaders,
} = require("../utils/unsubscribeLinks");

// ── Transport SES ─────────────────────────────────────────────────────────────
const sesClient = new SESClient({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const transporter = nodemailer.createTransport({
  send: async (mail, callback) => {
    try {
      const message = await new Promise((resolve, reject) => {
        mail.message.build((err, msg) => (err ? reject(err) : resolve(msg)));
      });
      await sesClient.send(
        new SendRawEmailCommand({ RawMessage: { Data: message } }),
      );
      callback(null, {});
    } catch (err) {
      callback(err);
    }
  },
});

// ── Helpers ───────────────────────────────────────────────────────────────────

const frequencyLabels = {
  instant: "instantanée",
  twice_daily: "2x par jour",
  daily: "quotidienne",
  weekly: "hebdomadaire",
};

function windowStart(frequency) {
  const now = new Date();
  const ms = {
    instant: 5 * 60 * 1000,
    twice_daily: 12 * 60 * 60 * 1000,
    daily: 24 * 60 * 60 * 1000,
    weekly: 7 * 24 * 60 * 60 * 1000,
  };
  return new Date(now - (ms[frequency] || ms.daily));
}

async function getUnreadMessages(userId, since, disabledFriends = []) {
  const conversations = await Conversation.find({ participants: userId })
    .select("_id participants clears")
    .lean();

  if (conversations.length === 0) return [];

  const disabledSet = new Set(disabledFriends.map(String));

  // Une conversation « supprimee pour moi » ne doit plus generer de relance
  // sur les messages anterieurs : on releve la borne au plus recent des deux
  // (debut de fenetre, date d'effacement) conversation par conversation.
  const valid = conversations.filter((conv) => {
    const otherId = conv.participants.find(
      (p) => p.toString() !== userId.toString(),
    );
    return otherId && !disabledSet.has(otherId.toString());
  });

  if (valid.length === 0) return [];

  const convClauses = valid.map((conv) => {
    const entry = (conv.clears || []).find(
      (c) => String(c.user) === String(userId),
    );
    const from =
      entry && entry.at > since ? entry.at : since;
    return { conversation: conv._id, createdAt: { $gte: from } };
  });

  return Message.aggregate([
    {
      $match: {
        $or: convClauses,
        sender: { $ne: userId },
        "readBy.user": { $ne: userId },
      },
    },
    {
      $group: {
        _id: "$sender",
        count: { $sum: 1 },
        lastMessage: { $last: "$createdAt" },
      },
    },
    { $sort: { lastMessage: -1 } },
  ]);
}

// ── Template email ────────────────────────────────────────────────────────────
function buildChatEmailHtml({
  userName,
  userEmail,
  unreadGroups,
  appUrl,
  unsubscribeUrl,
  frequency,
}) {
  const rows = unreadGroups
    .map(
      (g) => `
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.08);font-size:15px;color:rgba(255,255,255,0.9);">
          <strong>${g.senderName}</strong>
        </td>
        <td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.08);text-align:right;font-size:15px;color:#7c6ee6;font-weight:600;">
          ${g.count} message${g.count > 1 ? "s" : ""}
        </td>
      </tr>`,
    )
    .join("");

  const total = unreadGroups.reduce((sum, g) => sum + g.count, 0);
  const frequencyLabel = frequencyLabels[frequency] || frequency;

  // « Ne plus recevoir… de X » = coupe l'email récap pour cet ami seulement
  // (User.chatEmailDisabledFriends). Pas un blocage : chat et push inchangés.
  const friendUnsubscribeLinks = unreadGroups
    .map(
      (g) =>
        `<a href="${buildUnsubscribeUrl(userEmail, "chat_friend", { friendId: g._id })}"
           style="display:block;color:#7c6ee6;text-decoration:none;margin-bottom:6px;">
          Ne plus recevoir d'email pour les messages de ${g.senderName}
        </a>`,
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
</head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;background-color:#1a1a2e;color:#ffffff;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color:#1a1a2e;">
    <tr>
      <td style="padding:40px 20px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%"
          style="max-width:600px;margin:0 auto;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);border-radius:16px;overflow:hidden;box-shadow:0 10px 40px rgba(0,0,0,0.3);">
          <tr>
            <td style="padding:36px 40px 16px 40px;text-align:center;">
              <h1 style="margin:0;font-size:28px;font-weight:700;color:#fff;">💬 BirthReminder</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:0 40px 16px 40px;text-align:center;">
              <div style="display:inline-block;background:rgba(255,255,255,0.2);padding:7px 18px;border-radius:20px;">
                <span style="font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:1px;">
                  ${unreadGroups.reduce((s, g) => s + g.count, 0)} message${unreadGroups.reduce((s, g) => s + g.count, 0) > 1 ? "s" : ""} non lu${unreadGroups.reduce((s, g) => s + g.count, 0) > 1 ? "s" : ""}
                </span>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 40px 8px 40px;">
              <p style="margin:0 0 16px 0;font-size:16px;color:rgba(255,255,255,0.9);">
                Bonjour <strong>${userName}</strong>,<br>
                vous avez des messages non lus sur BirthReminder :
              </p>
              <table width="100%" cellspacing="0" cellpadding="0"
                style="border-top:1px solid rgba(255,255,255,0.15);">
                ${rows}
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 40px 40px 40px;text-align:center;">
              <a href="${appUrl}/home"
                style="display:inline-block;background:#fff;color:#667eea;text-decoration:none;padding:14px 36px;border-radius:8px;font-weight:600;font-size:15px;box-shadow:0 4px 15px rgba(0,0,0,0.2);">
                Voir mes messages →
              </a>
            </td>
          </tr>
        </table>

        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%"
          style="max-width:600px;margin:12px auto 0;">
          <tr>
            <td style="padding:14px 20px;text-align:center;font-size:13px;color:#aaa;line-height:1.6;background:rgba(255,255,255,0.04);border-radius:10px;">
              💡 Vous recevez ces emails en fréquence <strong style="color:#7c6ee6;">${frequencyLabel}</strong>.
              Pour modifier vos préférences, rendez-vous dans votre
              <a href="${appUrl}/home?tab=notifications&section=chat" style="color:#7c6ee6;text-decoration:none;">profil → Notifications</a>.
            </td>
          </tr>
        </table>

        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%"
          style="max-width:600px;margin:12px auto 0;">
          <tr>
            <td style="padding:16px;text-align:center;font-size:12px;color:#888;line-height:2;">
              ${friendUnsubscribeLinks}
              <a href="${unsubscribeUrl}" style="color:#888;text-decoration:none;display:block;margin-top:4px;">
                Ne plus recevoir d'emails pour les messages chat
              </a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ── Logique principale ────────────────────────────────────────────────────────
async function sendChatNotifications(frequency) {
  console.log(`💬 [CRON-CHAT] Démarrage — fréquence : ${frequency}`);

  try {
    // Récupère tous les users concernés par les emails OU les push
    const users = await userModel
      .find({
        isVerified: true,
        deletedAt: null,
        $or: [
          // Veut des emails chat
          { receiveChatEmails: true, chatEmailFrequency: frequency },
          // Veut des push chat (instantané uniquement côté push)
          { pushEnabled: true, "pushEvents.chat": true },
        ],
      })
      .lean();

    console.log(`💬 [CRON-CHAT] ${users.length} utilisateur(s) à vérifier`);

    let emailsSent = 0;
    let pushSent = 0;

    for (const user of users) {
      if (!user.email) continue;

      // ── Fenêtre temporelle pour cet user ──
      const since = windowStart(frequency);

      // ── Canaux : email et push sont décidés INDÉPENDAMMENT ──
      // (règle projet : couper un canal ne doit jamais couper l'autre)
      let wantsEmail =
        user.receiveChatEmails === true &&
        user.chatEmailFrequency === frequency;

      // Anti-doublon email en mode instant. Avant, c'était un `continue` qui
      // sautait aussi le push.
      if (wantsEmail && frequency === "instant" && user.lastChatEmailSent) {
        if (new Date(user.lastChatEmailSent) >= since) wantsEmail = false;
      }

      // Push web récap : uniquement sur le passage « instant » (toutes les
      // 5 min). Sinon un utilisateur push recevait en plus un récap à chaque
      // passage daily / twice_daily / weekly, avec une fenêtre plus large.
      const wantsPush =
        frequency === "instant" &&
        user.pushEnabled === true &&
        user.pushEvents?.chat !== false;

      if (!wantsEmail && !wantsPush) continue;

      // Tous les non-lus, sans filtre : le filtre par ami ne concerne que l'email.
      const unreadGroups = await getUnreadMessages(user._id, since);
      if (unreadGroups.length === 0) continue;

      // ── Enrichir avec les noms des expéditeurs ──
      const senderIds = unreadGroups.map((g) => g._id);
      const senders = await userModel
        .find({ _id: { $in: senderIds } }, "name surname")
        .lean();
      const senderMap = Object.fromEntries(
        senders.map((s) => [s._id.toString(), s]),
      );

      const enrichedGroups = unreadGroups.map((g) => {
        const sender = senderMap[g._id.toString()];
        return {
          ...g,
          senderName: sender
            ? `${sender.name} ${sender.surname || ""}`.trim()
            : "Quelqu'un",
        };
      });

      // ── Envoi email (sans les amis coupés via « Ne plus recevoir… ») ──
      const disabledSet = new Set(
        (user.chatEmailDisabledFriends || []).map(String),
      );
      const emailGroups = enrichedGroups.filter(
        (g) => !disabledSet.has(g._id.toString()),
      );

      if (wantsEmail && emailGroups.length > 0) {
        const appUrl = process.env.FRONTEND_URL;
        const unsubscribeUrl = buildUnsubscribeUrl(user.email, "chat");
        const total = emailGroups.reduce((s, g) => s + g.count, 0);

        const html = buildChatEmailHtml({
          userName: user.name,
          userEmail: user.email,
          unreadGroups: emailGroups,
          appUrl,
          unsubscribeUrl,
          frequency,
        });

        const subject = `💬 ${total} message${total > 1 ? "s" : ""} non lu${total > 1 ? "s" : ""} sur BirthReminder`;
        const textBody = [
          `Bonjour ${user.name},`,
          ``,
          `Vous avez ${total} message(s) non lu(s) sur BirthReminder.`,
          ``,
          `Voir : ${appUrl}/home`,
          ``,
          `Se désabonner : ${unsubscribeUrl}`,
        ].join("\n");

        await new Promise((resolve, reject) => {
          transporter.sendMail(
            {
              from: `BirthReminder <${process.env.EMAIL_BRTHDAY}>`,
              to: user.email,
              subject,
              html,
              text: textBody,
              headers: listUnsubscribeHeaders(unsubscribeUrl),
            },
            (err, info) => (err ? reject(err) : resolve(info)),
          );
        });

        await userModel.updateOne(
          { _id: user._id },
          { $set: { lastChatEmailSent: new Date() } },
        );

        emailsSent++;
        console.log(
          `✅ [CRON-CHAT] Email envoyé à ${user.name} (${user.email})`,
        );
      }

      // ── Envoi push (tous les expéditeurs, réglage email ignoré) ──
      if (wantsPush) {
        const total = enrichedGroups.reduce((s, g) => s + g.count, 0);
        const senderNames = enrichedGroups.map((g) => g.senderName).join(", ");

        // Un seul expéditeur → deep-link direct vers la conversation.
        // enrichedGroups[i]._id = id de l'expéditeur = friendId côté client.
        // Plusieurs expéditeurs → on reste sur /home (push groupée).
        const pushUrl =
          enrichedGroups.length === 1
            ? `/home?tab=chat&friendId=${enrichedGroups[0]._id}`
            : "/home";

        await sendPushToUser(user._id, {
          title: `💬 ${total} message${total > 1 ? "s" : ""} non lu${total > 1 ? "s" : ""}`,
          body: `De : ${senderNames}`,
          url: pushUrl,
          tag: "birthreminder-chat",
          // Web uniquement : sur mobile chaque message a déjà sa propre notif,
          // ce récap ferait doublon.
          webOnly: true,
        });

        pushSent++;
        console.log(`🔔 [PUSH-CHAT] Push envoyée à ${user.name}`);
      }
    }

    console.log(
      `💬 [CRON-CHAT] Terminé — ${emailsSent} email(s), ${pushSent} push envoyée(s)`,
    );
  } catch (err) {
    console.error("❌ [CRON-CHAT] Erreur :", err);
  }
}

// ── Planification ─────────────────────────────────────────────────────────────

const chatCronInstant = cron.schedule(
  "*/5 * * * *",
  () => sendChatNotifications("instant"),
  { scheduled: false },
);

const chatCronDaily = cron.schedule(
  "0 9 * * *",
  () => sendChatNotifications("daily"),
  { scheduled: false },
);

const chatCronWeekly = cron.schedule(
  "0 9 * * 1",
  () => sendChatNotifications("weekly"),
  { scheduled: false },
);

const chatCronTwiceDaily = cron.schedule(
  "0 9,18 * * *",
  () => sendChatNotifications("twice_daily"),
  { scheduled: false },
);

module.exports = {
  chatCronInstant,
  chatCronTwiceDaily,
  chatCronDaily,
  chatCronWeekly,
  sendChatNotifications,
};
