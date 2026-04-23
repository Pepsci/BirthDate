/**
 * Script de test — Récap mensuel BirthReminder
 * Usage : node test-monthly-recap.js [option]
 *
 * Options :
 *   --preview     Affiche le HTML dans la console sans envoyer
 *   --empty       Force le cas "mois sans anniversaire"
 *   --all         Envoie à tous les users avec monthlyRecap: true
 *   --email=xxx   Envoie à une adresse précise (défaut: premier user trouvé)
 *   --dry-run     Simule sans envoyer (log seulement)
 */

require("dotenv").config();
require("../config/mongoDb");

const User = require("../models/user.model");
const dateModel = require("../models/date.model");
const {
  sendMonthlyRecapEmail,
} = require("../services/emailTemplates/monthlyRecapEmail");
const {
  getMonthlyRecapTemplate,
  getEmptyMonthTemplate,
} = require("../services/emailTemplates/monthlyRecapEmail");

// ─── Parse les args ──────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const hasFlag = (flag) => args.includes(flag);
const getArg = (key) => {
  const found = args.find((a) => a.startsWith(`--${key}=`));
  return found ? found.split("=")[1] : null;
};

const IS_PREVIEW = hasFlag("--preview");
const IS_EMPTY = hasFlag("--empty");
const IS_ALL = hasFlag("--all");
const IS_DRY_RUN = hasFlag("--dry-run");
const TARGET_EMAIL = getArg("email");

// ─── Couleurs console ────────────────────────────────────────────────────────
const c = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  cyan: "\x1b[36m",
  gray: "\x1b[90m",
  bold: "\x1b[1m",
  yellow: "\x1b[33m",
};
const log = (msg) => console.log(`${c.cyan}${msg}${c.reset}`);
const ok = (msg) => console.log(`${c.green}✅ ${msg}${c.reset}`);
const err = (msg) => console.log(`${c.red}❌ ${msg}${c.reset}`);
const info = (msg) => console.log(`${c.gray}   ${msg}${c.reset}`);
const warn = (msg) => console.log(`${c.yellow}⚠️  ${msg}${c.reset}`);

// ─── Helper : afficher le résumé d'un user ───────────────────────────────────
function printUserSummary(user, dates) {
  const today = new Date();
  const month = today.getMonth();
  const datesThisMonth = dates.filter(
    (d) => new Date(d.date).getMonth() === month,
  );

  console.log(
    `\n${c.bold}👤 ${user.name} ${user.surname || ""} <${user.email}>${c.reset}`,
  );
  info(`monthlyRecap    : ${user.monthlyRecap}`);
  info(`receiveBirthday : ${user.receiveBirthdayEmails}`);
  info(`Total dates     : ${dates.length}`);
  info(`Ce mois-ci      : ${datesThisMonth.length} anniversaire(s)`);

  if (datesThisMonth.length > 0) {
    datesThisMonth.forEach((d) => {
      const bd = new Date(d.date);
      info(`  → ${d.name} ${d.surname} — ${bd.getDate()}/${bd.getMonth() + 1}`);
    });
  }
}

// ─── Helper : écrire le HTML dans un fichier pour preview ───────────────────
const fs = require("fs");
const path = require("path");

function saveHtmlPreview(html, filename) {
  const outPath = path.join(__dirname, filename);
  fs.writeFileSync(outPath, html, "utf8");
  ok(`HTML sauvegardé → ${outPath}`);
  info("Ouvre ce fichier dans ton navigateur pour prévisualiser.");
}

// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log(
    `\n${c.bold}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${c.reset}`,
  );
  console.log(`${c.bold}  🧪 Test récap mensuel BirthReminder${c.reset}`);
  console.log(
    `${c.bold}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${c.reset}\n`,
  );

  // Attendre la connexion MongoDB
  await new Promise((resolve) => setTimeout(resolve, 1500));

  // ── Trouver le(s) user(s) cible(s) ──────────────────────────────────────
  let users = [];

  if (IS_ALL) {
    log("Mode --all : récupération des users avec monthlyRecap: true...");
    users = await User.find({
      monthlyRecap: true,
      receiveBirthdayEmails: { $ne: false },
      deletedAt: { $exists: false },
    });
    if (users.length === 0) {
      warn("Aucun user avec monthlyRecap: true trouvé.");
      warn(
        "Active d'abord le récap sur un compte via l'UI ou via MongoDB Compass.",
      );
      process.exit(0);
    }
    ok(`${users.length} user(s) trouvé(s)`);
  } else if (TARGET_EMAIL) {
    log(`Mode --email : recherche de ${TARGET_EMAIL}...`);
    const user = await User.findOne({ email: TARGET_EMAIL });
    if (!user) {
      err(`User introuvable : ${TARGET_EMAIL}`);
      process.exit(1);
    }
    users = [user];
  } else {
    log("Aucune option spécifiée — utilisation du premier user en base...");
    const user = await User.findOne({ deletedAt: { $exists: false } });
    if (!user) {
      err("Aucun user trouvé en base.");
      process.exit(1);
    }
    users = [user];
    warn(`Pas d'option --email spécifiée. Cible par défaut : ${user.email}`);
    warn("Utilise --email=ton@email.com pour cibler un compte précis.");
  }

  // ── Traitement de chaque user ────────────────────────────────────────────
  for (const user of users) {
    let dates = await dateModel
      .find({ owner: user._id })
      .populate("linkedUser", "name surname");

    // Forcer le cas mois vide si demandé
    if (IS_EMPTY) {
      warn("--empty : simulation mois sans anniversaire");
      dates = [];
    }

    printUserSummary(user, dates);

    // ── Mode preview : générer le HTML sans envoyer ──────────────────────
    if (IS_PREVIEW) {
      log("\nMode --preview : génération du HTML...");

      // On importe les fonctions internes pour générer le HTML directement
      // (nécessite de les exporter depuis monthlyRecapEmail.js)
      const today = new Date();
      const month = today.getMonth();
      const MONTH_NAMES = [
        "janvier",
        "février",
        "mars",
        "avril",
        "mai",
        "juin",
        "juillet",
        "août",
        "septembre",
        "octobre",
        "novembre",
        "décembre",
      ];
      const DAY_NAMES = [
        "dimanche",
        "lundi",
        "mardi",
        "mercredi",
        "jeudi",
        "vendredi",
        "samedi",
      ];
      const FRONTEND_URL =
        process.env.FRONTEND_URL || "https://birthreminder.com";

      const datesThisMonth = dates
        .filter((d) => new Date(d.date).getMonth() === month)
        .map((d) => {
          const bd = new Date(d.date);
          const birthdayThisYear = new Date(
            today.getFullYear(),
            month,
            bd.getDate(),
          );
          const diffMs =
            birthdayThisYear - new Date(today.setHours(0, 0, 0, 0));
          const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
          const dayName = DAY_NAMES[birthdayThisYear.getDay()];
          let dateLabel, daysLabel;
          if (diffDays === 0) {
            dateLabel = `Aujourd'hui ${bd.getDate()} ${MONTH_NAMES[month]}`;
            daysLabel = "Aujourd'hui";
          } else if (diffDays === 1) {
            dateLabel = `${dayName} ${bd.getDate()} ${MONTH_NAMES[month]} · demain`;
            daysLabel = "Demain";
          } else if (diffDays > 0) {
            dateLabel = `${dayName} ${bd.getDate()} ${MONTH_NAMES[month]}`;
            daysLabel = `J-${diffDays}`;
          } else {
            dateLabel = `${dayName} ${bd.getDate()} ${MONTH_NAMES[month]}`;
            daysLabel = "Passé";
          }
          return {
            ...d.toObject(),
            diffDays,
            dateLabel,
            daysLabel,
            birthdayThisYear,
          };
        })
        .sort((a, b) => a.birthdayThisYear - b.birthdayThisYear);

      const monthName = MONTH_NAMES[month];
      const nextMonth = (month + 1) % 12;
      const nextYear =
        nextMonth === 0 ? today.getFullYear() + 1 : today.getFullYear();
      const nextMonthName = MONTH_NAMES[nextMonth];
      const nextMonthUrl = `${FRONTEND_URL}/home?tab=agenda&month=${nextMonth + 1}&year=${nextYear}`;
      const unsubscribeUrl = `${FRONTEND_URL}/unsubscribe?userId=${user._id}&type=monthlyRecap`;

      // Appel direct à sendMonthlyRecapEmail pour générer le HTML
      // On override SES pour capturer le HTML sans envoyer
      const filename =
        datesThisMonth.length > 0
          ? `preview-monthly-recap-${monthName}.html`
          : `preview-monthly-recap-empty-${monthName}.html`;

      // Patch temporaire : remplace SES par un mock qui écrit le fichier
      const originalSend = require("@aws-sdk/client-ses").SESClient.prototype
        .send;
      require("@aws-sdk/client-ses").SESClient.prototype.send = async (cmd) => {
        const html = cmd.input.Message.Body.Html.Data;
        saveHtmlPreview(html, filename);
        ok(`Subject: ${cmd.input.Message.Subject.Data}`);
        ok(`To: ${cmd.input.Destination.ToAddresses[0]}`);
        info("Email NON envoyé (mode preview)");
      };

      await sendMonthlyRecapEmail(user, IS_EMPTY ? [] : dates);

      // Restore
      require("@aws-sdk/client-ses").SESClient.prototype.send = originalSend;

      // ── Mode dry-run : log seulement ─────────────────────────────────────
    } else if (IS_DRY_RUN) {
      log("\nMode --dry-run : simulation sans envoi...");
      const datesThisMonth = dates.filter(
        (d) => new Date(d.date).getMonth() === new Date().getMonth(),
      );
      const subject =
        datesThisMonth.length > 0
          ? `🎂 ${datesThisMonth.length} anniversaire(s) ce mois-ci`
          : `📅 Récap BirthReminder — mois vide`;
      ok(`Sujet    : ${subject}`);
      ok(`Destinat.: ${user.email}`);
      ok(`Dates    : ${datesThisMonth.length} ce mois-ci`);
      info("Email NON envoyé (dry-run).");

      // ── Envoi réel ────────────────────────────────────────────────────────
    } else {
      log("\nEnvoi réel via AWS SES...");
      await sendMonthlyRecapEmail(user, IS_EMPTY ? [] : dates);
      ok(`Email envoyé à ${user.email}`);
      info("Vérifie ta boîte mail dans quelques secondes.");
    }
  }

  console.log(
    `\n${c.bold}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${c.reset}`,
  );
  console.log(`${c.bold}  Terminé${c.reset}`);
  console.log(
    `${c.bold}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${c.reset}\n`,
  );
  process.exit(0);
}

main().catch((e) => {
  err(`Erreur inattendue : ${e.message}`);
  console.error(e);
  process.exit(1);
});
