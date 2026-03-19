const { SESClient, SendEmailCommand } = require("@aws-sdk/client-ses");
const {
  emailHeader,
  emailFooter,
  badge,
  title,
  paragraph,
  ctaButton,
  avatarBlock,
  sectionLabel,
  metricRow,
} = require("./emailHelpers");

const sesClient = new SESClient({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const FRONTEND_URL = process.env.FRONTEND_URL || "https://birthreminder.com";

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

// ─── Helpers ────────────────────────────────────────────────────────────────

function getMonthDates(dates, year, month) {
  return dates
    .filter((d) => new Date(d.date).getMonth() === month)
    .map((d) => {
      const bd = new Date(d.date);
      const birthdayThisYear = new Date(year, month, bd.getDate());
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const diffMs = birthdayThisYear.getTime() - today.getTime();
      const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

      const dayName = DAY_NAMES[birthdayThisYear.getDay()];
      const dayNum = bd.getDate();
      const monthName = MONTH_NAMES[month];

      let dateLabel, daysLabel;
      if (diffDays === 0) {
        dateLabel = `Aujourd'hui ${dayNum} ${monthName}`;
        daysLabel = "Aujourd'hui";
      } else if (diffDays === 1) {
        dateLabel = `${dayName} ${dayNum} ${monthName} · demain`;
        daysLabel = "Demain";
      } else if (diffDays > 0) {
        dateLabel = `${dayName} ${dayNum} ${monthName}`;
        daysLabel = `J-${diffDays}`;
      } else {
        dateLabel = `${dayName} ${dayNum} ${monthName}`;
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
}

// MODIFIÉ : dateId pour tout le monde, contacts manuels inclus
function buildProfileUrl(date) {
  return `${FRONTEND_URL}/home?tab=date&dateId=${date._id}`;
}

// MODIFIÉ : month et year explicites dans l'URL agenda
function buildAgendaUrl(month, year) {
  return `${FRONTEND_URL}/home?tab=agenda&month=${month + 1}&year=${year}`;
}

// ─── Template : mois avec anniversaires ─────────────────────────────────────

function getMonthlyRecapTemplate({
  ownerName,
  monthName,
  year,
  month,
  datesThisMonth,
  nextMonthName,
  nextMonthUrl,
  unsubscribeUrl,
}) {
  const total = datesThisMonth.length;
  const thisWeekDates = datesThisMonth.filter(
    (d) => d.diffDays >= 0 && d.diffDays <= 7,
  );
  const laterDates = datesThisMonth.filter(
    (d) => d.diffDays > 7 || d.diffDays < 0,
  );
  const today = new Date();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const remaining = Math.max(daysInMonth - today.getDate() + 1, 0);

  let rows = "";
  if (thisWeekDates.length > 0) {
    rows += sectionLabel("Cette semaine");
    thisWeekDates.forEach((d) => {
      rows += avatarBlock(
        d.name,
        d.surname,
        d.dateLabel,
        d.daysLabel,
        true,
        buildProfileUrl(d),
      );
    });
  }
  if (laterDates.length > 0) {
    rows += sectionLabel("Plus tard ce mois");
    laterDates.forEach((d) => {
      rows += avatarBlock(
        d.name,
        d.surname,
        d.dateLabel,
        d.daysLabel,
        false,
        buildProfileUrl(d),
      );
    });
  }

  const agendaUrl = buildAgendaUrl(month, year);

  return (
    emailHeader() +
    badge(`${monthName} ${year}`) +
    title(`Vos anniversaires de ${monthName}`) +
    paragraph(
      `Bonjour ${ownerName}, voici un aperçu des anniversaires du mois.`,
    ) +
    metricRow([
      { value: total, label: "anniversaire" + (total > 1 ? "s" : "") },
      { value: thisWeekDates.length, label: "cette semaine" },
      { value: remaining, label: "jours restants" },
    ]) +
    rows +
    `<tr><td style="padding:8px 0;"></td></tr>` +
    ctaButton(agendaUrl, "Voir le calendrier complet") +
    emailFooter(`
      <p style="margin:0 0 8px;font-size:12px;color:#6b7280;">
        <a href="${unsubscribeUrl}" style="color:#6b7280;text-decoration:none;">
          Se désabonner du récap mensuel
        </a>
      </p>
    `)
  );
}

// ─── Template : mois sans anniversaire ──────────────────────────────────────

function getEmptyMonthTemplate({
  ownerName,
  monthName,
  year,
  nextMonthName,
  nextMonthUrl,
  unsubscribeUrl,
}) {
  return (
    emailHeader() +
    badge(`${monthName} ${year}`) +
    title(`Récap de ${monthName}`) +
    `<tr><td align="center" style="padding:8px 40px 4px;">
      <div style="width:64px;height:64px;background:rgba(255,255,255,0.15);border-radius:50%;text-align:center;line-height:64px;font-size:30px;margin:0 auto;">🎂</div>
    </td></tr>` +
    paragraph(
      `Rien à l'horizon pour ${monthName}, ${ownerName}.<br>Un peu de répit — pensez à préparer ${nextMonthName} !`,
    ) +
    ctaButton(nextMonthUrl, `Voir ${nextMonthName} →`) +
    `<tr>
      <td style="border-top:1px solid rgba(255,255,255,0.1);padding:20px 40px 8px;" align="center">
        <p style="margin:0 0 12px;font-size:13px;color:rgba(255,255,255,0.6);">
          Vos amis ont peut-être des anniversaires non enregistrés
        </p>
        <a href="${FRONTEND_URL}/home?tab=friends" style="
          display:inline-block;
          border:1px solid rgba(255,255,255,0.3);
          color:rgba(255,255,255,0.8);
          text-decoration:none;
          font-size:13px;font-weight:600;
          padding:8px 20px;border-radius:8px;
        ">Inviter des amis</a>
      </td>
    </tr>
    <tr><td style="padding:8px 0 16px;"></td></tr>` +
    emailFooter(`
      <p style="margin:0 0 8px;font-size:12px;color:#6b7280;">
        <a href="${unsubscribeUrl}" style="color:#6b7280;text-decoration:none;">
          Se désabonner du récap mensuel
        </a>
      </p>
    `)
  );
}

// ─── Fonction d'envoi ────────────────────────────────────────────────────────

async function sendMonthlyRecapEmail(owner, dates) {
  try {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();
    const monthName = MONTH_NAMES[month];

    const nextMonth = (month + 1) % 12;
    const nextYear = nextMonth === 0 ? year + 1 : year;
    const nextMonthName = MONTH_NAMES[nextMonth];
    const nextMonthUrl = buildAgendaUrl(nextMonth, nextYear);
    const unsubscribeUrl = `${FRONTEND_URL}/unsubscribe?userId=${owner._id}&type=monthlyRecap`;

    const datesThisMonth = getMonthDates(dates, year, month);

    const subject =
      datesThisMonth.length > 0
        ? `🎂 ${datesThisMonth.length} anniversaire${datesThisMonth.length > 1 ? "s" : ""} en ${monthName} !`
        : `📅 Récap BirthReminder — ${monthName} ${year}`;

    const html =
      datesThisMonth.length > 0
        ? getMonthlyRecapTemplate({
            ownerName: owner.name,
            monthName,
            year,
            month,
            datesThisMonth,
            nextMonthName,
            nextMonthUrl,
            unsubscribeUrl,
          })
        : getEmptyMonthTemplate({
            ownerName: owner.name,
            monthName,
            year,
            nextMonthName,
            nextMonthUrl,
            unsubscribeUrl,
          });

    const text =
      datesThisMonth.length > 0
        ? `Bonjour ${owner.name},\n\n${datesThisMonth.length} anniversaire(s) ce mois-ci :\n\n` +
          datesThisMonth
            .map((d) => `- ${d.name} ${d.surname} · ${d.dateLabel}`)
            .join("\n") +
          `\n\nVoir le calendrier : ${buildAgendaUrl(month, year)}\n\n---\nSe désabonner : ${unsubscribeUrl}`
        : `Bonjour ${owner.name},\n\nAucun anniversaire en ${monthName}.\n\nVoir ${nextMonthName} : ${nextMonthUrl}\n\n---\nSe désabonner : ${unsubscribeUrl}`;

    const params = {
      Source: `BirthReminder <${process.env.EMAIL_BRTHDAY}>`,
      Destination: { ToAddresses: [owner.email] },
      Message: {
        Subject: { Data: subject, Charset: "UTF-8" },
        Body: {
          Html: { Data: html, Charset: "UTF-8" },
          Text: { Data: text, Charset: "UTF-8" },
        },
      },
    };

    await sesClient.send(new SendEmailCommand(params));
    console.log(`✅ Récap mensuel ${monthName} envoyé à ${owner.email}`);
  } catch (error) {
    console.error(`❌ Erreur récap mensuel à ${owner.email}:`, error);
  }
}

module.exports = { sendMonthlyRecapEmail };
