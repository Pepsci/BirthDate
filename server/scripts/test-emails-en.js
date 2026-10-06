/**
 * Vérifie les emails anglais SANS rien envoyer.
 *
 *   node scripts/test-emails-en.js
 *
 * L'envoi SES est remplacé par une capture : chaque email anglais est
 * construit avec de fausses données, puis on contrôle qu'il ne reste pas de
 * français dedans. Sert surtout de garde-fou pour `en/emailHelpers.js`, qui
 * remplace des phrases des briques françaises : si l'une d'elles change, ce
 * script le signale.
 */
process.env.AWS_REGION ||= "eu-west-3";
process.env.AWS_ACCESS_KEY_ID ||= "test";
process.env.AWS_SECRET_ACCESS_KEY ||= "test";
process.env.FRONTEND_URL ||= "https://birthreminder.com";
process.env.EMAIL_BRTHDAY ||= "test@birthreminder.com";

const { SESClient } = require("@aws-sdk/client-ses");

// ── Capture des envois ──────────────────────────────────────────────────────
const sent = [];
SESClient.prototype.send = async function (command) {
  const input = command.input || {};
  if (input.Message) {
    sent.push({
      subject: input.Message.Subject.Data,
      body:
        (input.Message.Body.Html?.Data || "") +
        (input.Message.Body.Text?.Data || ""),
    });
  } else if (input.RawMessage) {
    // nodemailer : message MIME brut, encodé en quoted-printable.
    const raw = Buffer.from(input.RawMessage.Data)
      .toString("utf8")
      .replace(/=\r?\n/g, "")
      .replace(/((?:=[0-9A-F]{2})+)/g, (m) =>
        Buffer.from(m.replace(/=/g, ""), "hex").toString("utf8"),
      );
    sent.push({ subject: "(brut)", body: raw });
  }
  return { MessageId: "test" };
};

// Les phrases introuvables de en/emailHelpers.js arrivent par console.warn.
const warnings = [];
const realWarn = console.warn;
console.warn = (...args) => warnings.push(args.join(" "));
const realLog = console.log;
console.log = () => {};

const { emailsFor } = require("../services/emailTemplates/localized");
const chat = require("../services/emailTemplates/en/chatRecapEmail");
const en = emailsFor("en");

const owner = { _id: "u1", name: "Joss", surname: "F", email: "a@b.c" };
const date = {
  _id: "d1",
  name: "Anna",
  surname: "Lee",
  nameday: "07-26",
  date: new Date(),
  owner,
  toObject() {
    return { _id: this._id, name: this.name, surname: this.surname };
  },
};
const event = { title: "Party", shortId: "abc", accessCode: "1234" };

async function run() {
  await en.sendVerificationEmail("a@b.c", "tok");
  await en.sendPasswordResetEmail("a@b.c", "tok");
  await en.sendFriendRequestNotification("a@b.c", "Anna", "u1");
  await en.sendInvitationEmail("a@b.c", "Anna", "tok");
  await en.sendEventInvitationEmail("a@b.c", event, "Anna", "https://x");
  await en.sendEventReminderEmail("a@b.c", event, 1, "https://x");
  await en.sendEventReminderEmail("a@b.c", event, 3, "https://x");
  await en.sendEventVoteRequestEmail("a@b.c", event, "date", "https://x");
  await en.sendEventDateConfirmedEmail("a@b.c", event, "1 May", "https://x");
  await en.sendEventDateChangedEmail("a@b.c", event, "1 May", "https://x", "1234");
  await en.sendEventCancelledEmail("a@b.c", { event, reason: "Rain", organizerName: "Anna" });
  for (const days of [0, 1, 7]) {
    await en.sendBirthdayReminderEmail(owner, date, days);
    await en.sendNamedayReminderEmail(date, days);
  }
  await en.sendBirthdayReminderEmail(owner, null, 0);
  await en.sendMonthlyRecapEmail(owner, [date]);
  await en.sendMonthlyRecapEmail(owner, []);
  await en.sendContributionReceiptEmail({
    email: "a@b.c",
    guestName: "Anna",
    amount: 1500,
    eventTitle: "Party",
    eventShortId: "abc",
    organizerName: "Joss F",
    reference: "pi_123",
  });
  sent.push({
    subject: chat.chatEmailSubject(2),
    body: chat.buildChatEmailHtml({
      userName: "Joss",
      userEmail: "a@b.c",
      unreadGroups: [{ _id: "u2", senderName: "Anna", count: 2 }],
      appUrl: "https://x",
      unsubscribeUrl: "https://u",
      frequency: "daily",
    }),
  });

  console.log = realLog;
  console.warn = realWarn;

  // Mots qui n'existent pas en anglais : leur présence trahit un oubli.
  const FRENCH =
    /\b(bonjour|vous|votre|vos|anniversaires?|fête|voir|désabonner|fait avec|copiez|ouvrir|événement|aujourd'hui|demain|cliquez|merci|envoyé|cet email|ne plus)\b/gi;
  let problems = warnings.length;
  warnings.forEach((w) => console.log("⚠️ ", w));
  for (const mail of sent) {
    const text = (mail.subject + " " + mail.body).replace(/<style[\s\S]*?<\/style>/g, "");
    const found = [...new Set((text.match(FRENCH) || []).map((w) => w.toLowerCase()))];
    if (found.length) {
      problems += 1;
      console.log(`❌ ${mail.subject} → français restant : ${found.join(", ")}`);
    }
  }
  console.log(
    problems
      ? `\n${problems} problème(s) sur ${sent.length} emails.`
      : `✅ ${sent.length} emails anglais construits, aucun français restant.`,
  );
  process.exit(problems ? 1 : 0);
}

run().catch((err) => {
  console.log = realLog;
  console.error("❌ Erreur :", err);
  process.exit(1);
});
