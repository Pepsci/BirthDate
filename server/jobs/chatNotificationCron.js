/**
 * chatNotificationCron.js
 *
 * Envoie des emails + push notifications pour les messages chat non lus.
 * Respecte les préférences de l'utilisateur :
 *   - receiveChatEmails (bool)          : activer/désactiver emails globalement
 *   - chatEmailFrequency                : "instant" | "twice_daily" | "daily" | "weekly"
 *   - chatEmailDisabledFriends          : [userId] — liste d'amis exclus emails
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
    .select("_id participants")
    .lean();

  if (conversations.length === 0) return [];

  const disabledSet = new Set(disabledFriends.map(String));

  const validConvIds = conversations
    .filter((conv) => {
      const otherId = conv.participants.find(
        (p) => p.toString() !== userId.toString(),
      );
      return otherId && !disabledSet.has(otherId.toString());
    })
    .map((c) => c._id);

  if (validConvIds.length === 0) return [];

  return Message.aggregate([
    {
      $match: {
        conversation: { $in: validConvIds },
        sender: { $ne: userId },
        createdAt: { $gte: since },
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

  const friendUnsubscribeLinks = unreadGroups
    .map(
      (g) =>
        `<a href="${appUrl}/api/unsubscribe?email=${encodeURIComponent(userEmail)}&type=chat_friend&friendId=${g._id}"
           style="display:block;color:#7c6ee6;text-decoration:none;margin-bottom:6px;">
          Ne plus recevoir les messages de ${g.senderName}
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

      // ── Anti-doublon email mode instant ──
      const wantsEmail =
        user.receiveChatEmails === true &&
        user.chatEmailFrequency === frequency;

      if (wantsEmail && frequency === "instant" && user.lastChatEmailSent) {
        const lastSent = new Date(user.lastChatEmailSent);
        if (lastSent >= since) continue;
      }

      const disabledFriends = user.chatEmailDisabledFriends || [];
      const unreadGroups = await getUnreadMessages(
        user._id,
        since,
        disabledFriends,
      );

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

      // ── Envoi email ──
      if (wantsEmail) {
        const appUrl = process.env.FRONTEND_URL;
        const unsubscribeUrl = `${appUrl}/api/unsubscribe?email=${encodeURIComponent(user.email)}&type=chat`;
        const total = enrichedGroups.reduce((s, g) => s + g.count, 0);

        const html = buildChatEmailHtml({
          userName: user.name,
          userEmail: user.email,
          unreadGroups: enrichedGroups,
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
          `Voir : ${process.env.FRONTEND_URL}/home`,
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
              headers: {
                "List-Unsubscribe": `<${unsubscribeUrl}>`,
                "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
              },
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

      // ── Envoi push ──
      const wantsPush =
        user.pushEnabled === true && user.pushEvents?.chat !== false;

      if (wantsPush) {
        const total = enrichedGroups.reduce((s, g) => s + g.count, 0);
        const senderNames = enrichedGroups.map((g) => g.senderName).join(", ");

        await sendPushToUser(user._id, {
          title: `💬 ${total} message${total > 1 ? "s" : ""} non lu${total > 1 ? "s" : ""}`,
          body: `De : ${senderNames}`,
          url: "/home",
          tag: "birthreminder-chat",
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
