// Version anglaise de l'email récap du chat, dont l'original français est
// écrit dans jobs/chatNotificationCron.js. Même mise en page, mêmes paramètres.
const { buildUnsubscribeUrl } = require("../../../utils/unsubscribeLinks");

const frequencyLabels = {
  instant: "instantly",
  twice_daily: "twice a day",
  daily: "daily",
  weekly: "weekly",
};

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
          ${g.count} ${g.count === 1 ? "message" : "messages"}
        </td>
      </tr>`,
    )
    .join("");

  const total = unreadGroups.reduce((sum, g) => sum + g.count, 0);
  const frequencyLabel = frequencyLabels[frequency] || frequency;

  const friendUnsubscribeLinks = unreadGroups
    .map(
      (g) =>
        `<a href="${buildUnsubscribeUrl(userEmail, "chat_friend", { friendId: g._id })}"
           style="display:block;color:#7c6ee6;text-decoration:none;margin-bottom:6px;">
          Stop emails about messages from ${g.senderName}
        </a>`,
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
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
                  ${total} unread ${total === 1 ? "message" : "messages"}
                </span>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 40px 8px 40px;">
              <p style="margin:0 0 16px 0;font-size:16px;color:rgba(255,255,255,0.9);">
                Hello <strong>${userName}</strong>,<br>
                you have unread messages on BirthReminder:
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
                See my messages →
              </a>
            </td>
          </tr>
        </table>

        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%"
          style="max-width:600px;margin:12px auto 0;">
          <tr>
            <td style="padding:14px 20px;text-align:center;font-size:13px;color:#aaa;line-height:1.6;background:rgba(255,255,255,0.04);border-radius:10px;">
              💡 You receive these emails <strong style="color:#7c6ee6;">${frequencyLabel}</strong>.
              To change your preferences, go to your
              <a href="${appUrl}/home?tab=notifications&section=chat" style="color:#7c6ee6;text-decoration:none;">profile → Notifications</a>.
            </td>
          </tr>
        </table>

        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%"
          style="max-width:600px;margin:12px auto 0;">
          <tr>
            <td style="padding:16px;text-align:center;font-size:12px;color:#888;line-height:2;">
              ${friendUnsubscribeLinks}
              <a href="${unsubscribeUrl}" style="color:#888;text-decoration:none;display:block;margin-top:4px;">
                Stop emails about chat messages
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

const chatEmailSubject = (total) =>
  `💬 ${total} unread ${total === 1 ? "message" : "messages"} on BirthReminder`;

const chatEmailText = ({ userName, total, appUrl, unsubscribeUrl }) =>
  [
    `Hello ${userName},`,
    ``,
    `You have ${total} unread ${total === 1 ? "message" : "messages"} on BirthReminder.`,
    ``,
    `See them: ${appUrl}/home`,
    ``,
    `Unsubscribe: ${unsubscribeUrl}`,
  ].join("\n");

module.exports = { buildChatEmailHtml, chatEmailSubject, chatEmailText };
