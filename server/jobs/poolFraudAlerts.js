// jobs/poolFraudAlerts.js
// Cron quotidien (8h) : détecte les cagnottes suspectes et envoie un email
// aux comptes admin si des alertes sont trouvées.

const cron = require("node-cron");
const User = require("../models/user.model");
const { computePoolAlerts } = require("../services/poolFraudService");
const {
  sendPoolFraudAlertEmail,
} = require("../services/emailTemplates/poolFraudAlertEmail");

async function runPoolFraudCheck() {
  try {
    const alerts = await computePoolAlerts();
    if (alerts.length === 0) {
      console.log("🛡️ Contrôle cagnottes : aucune alerte.");
      return;
    }

    // Destinataires : tous les admins (ou ADMIN_ALERT_EMAIL si défini)
    let toAddresses;
    if (process.env.ADMIN_ALERT_EMAIL) {
      toAddresses = [process.env.ADMIN_ALERT_EMAIL];
    } else {
      const admins = await User.find({ role: "admin", deletedAt: null }).select("email");
      toAddresses = admins.map((a) => a.email);
    }

    if (toAddresses.length === 0) {
      console.warn("🛡️ Alertes cagnottes détectées mais aucun destinataire admin.");
      return;
    }

    await sendPoolFraudAlertEmail(toAddresses, alerts);
    console.log(`🛡️ Contrôle cagnottes : ${alerts.length} alerte(s) envoyée(s).`);
  } catch (error) {
    console.error("❌ Erreur cron alertes cagnottes :", error);
  }
}

// Tous les jours à 8h
const poolFraudCronJob = cron.schedule("0 8 * * *", runPoolFraudCheck, {
  scheduled: false,
  timezone: "Europe/Paris",
});

module.exports = {
  start: () => poolFraudCronJob.start(),
  runPoolFraudCheck, // exporté pour test manuel
};
