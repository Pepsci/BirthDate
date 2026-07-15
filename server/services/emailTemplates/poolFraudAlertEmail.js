// services/emailTemplates/poolFraudAlertEmail.js
// Email quotidien envoyé aux admins quand des cagnottes suspectes sont détectées.

const { SESClient, SendEmailCommand } = require("@aws-sdk/client-ses");
const {
  emailHeader,
  emailFooter,
  icon,
  title,
  paragraph,
  ctaButton,
  note,
} = require("./emailHelpers");

const euros = (cents) => `${((cents || 0) / 100).toFixed(2)} €`;

const RULE_LABELS = {
  big_contribution: "💰 Grosse contribution unique",
  big_total: "📈 Total collecté élevé",
  velocity: "⚡ Afflux rapide de contributions",
  refund_ratio: "↩️ Taux de remboursement anormal",
};

function alertRowHtml(alert) {
  const sevColor = alert.severity === "high" ? "#ef4444" : "#f59e0b";
  const org = alert.event.organizer
    ? `${alert.event.organizer.name} ${alert.event.organizer.surname || ""} (${alert.event.organizer.email})`
    : "inconnu";

  return `
    <div style="border:1px solid #e5e7eb;border-left:4px solid ${sevColor};border-radius:8px;padding:12px 16px;margin:0 0 12px;">
      <p style="margin:0 0 4px;font-weight:600;color:#111827;">
        ${RULE_LABELS[alert.type] || alert.type} — ${alert.event.title}
      </p>
      <p style="margin:0 0 4px;font-size:14px;color:#374151;">${alert.details}</p>
      <p style="margin:0;font-size:12px;color:#6b7280;">
        Organisateur : ${org} · Collecté : ${euros(alert.totals.collected)}
        (${alert.totals.contributions} contribution(s), ${alert.totals.refunded} remboursée(s))
        · Event ${alert.event.shortId}
      </p>
    </div>`;
}

/*
 * Envoie le récap d'alertes aux adresses admin.
 * @param {string[]} toAddresses
 * @param {Array} alerts — sortie de computePoolAlerts()
 */
async function sendPoolFraudAlertEmail(toAddresses, alerts) {
  if (!toAddresses.length || !alerts.length) return;

  const client = new SESClient({
    region: process.env.AWS_REGION,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  });

  const frontendUrl = process.env.FRONTEND_URL || "https://birthreminder.com";
  const highCount = alerts.filter((a) => a.severity === "high").length;

  const html =
    emailHeader() +
    icon("🚨") +
    title(`${alerts.length} alerte(s) cagnotte détectée(s)`) +
    paragraph(
      `Le contrôle quotidien anti-fraude a détecté <strong>${alerts.length} alerte(s)</strong>` +
        (highCount ? `, dont <strong>${highCount} priorité haute</strong>` : "") +
        ". Détail ci-dessous.",
    ) +
    alerts.map(alertRowHtml).join("") +
    ctaButton(`${frontendUrl}/admin/alerts`, "Voir dans l'admin") +
    note(
      "Seuils actuels : contribution ≥ 250 €, total ≥ 2 000 €, ≥ 10 contributions/heure, remboursements ≥ 30 %.",
    ) +
    emailFooter();

  const textLines = alerts.map(
    (a) =>
      `- [${a.severity.toUpperCase()}] ${a.event.title} (${a.event.shortId}) : ${a.details}`,
  );

  const params = {
    Source: `BirthReminder <${process.env.EMAIL_BRTHDAY}>`,
    Destination: { ToAddresses: toAddresses },
    Message: {
      Subject: {
        Data: `🚨 BirthReminder Admin — ${alerts.length} alerte(s) cagnotte`,
        Charset: "UTF-8",
      },
      Body: {
        Html: { Data: html, Charset: "UTF-8" },
        Text: {
          Data: `Alertes cagnottes du jour :\n\n${textLines.join("\n")}\n\nDétail : ${frontendUrl}/admin/alerts`,
          Charset: "UTF-8",
        },
      },
    },
  };

  await client.send(new SendEmailCommand(params));
  console.log(`✅ Email d'alertes cagnottes envoyé à ${toAddresses.join(", ")}`);
}

module.exports = { sendPoolFraudAlertEmail };
