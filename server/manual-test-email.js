// // Script de test manuel pour envoyer des emails d'anniversaire
require("dotenv").config();
const mongoose = require("mongoose");

// Charger les modèles dans le bon ordre
const userModel = require("./models/user.model");
const dateModel = require("./models/date.model");

const { SESClient, SendRawEmailCommand } = require("@aws-sdk/client-ses");
const nodemailer = require("nodemailer");

// Configuration AWS SES
const sesClient = new SESClient({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

// Transporteur Nodemailer
const transporter = nodemailer.createTransport({
  send: async (mail, callback) => {
    try {
      const message = await new Promise((resolve, reject) => {
        mail.message.build((error, builtMessage) => {
          if (error) reject(error);
          else resolve(builtMessage);
        });
      });

      const command = new SendRawEmailCommand({
        RawMessage: { Data: message },
      });

      const response = await sesClient.send(command);
      callback(null, response);
    } catch (error) {
      callback(error);
    }
  },
  name: "ses-v3-transport",
});

// Fonction d'envoi d'email
async function sendTestEmail(email, name, surname, daysBeforeBirthday, dateId) {
  let subject, textContent, htmlContent;

  if (daysBeforeBirthday === 0) {
    subject = `[TEST] C'est aujourd'hui l'anniversaire de ${name} ${surname} !`;
    textContent = `[TEST] N'oubliez pas que c'est aujourd'hui l'anniversaire de ${name} ${surname} !`;
    htmlContent = `<p><strong>[EMAIL DE TEST]</strong></p><p>N'oubliez pas que c'est <strong>aujourd'hui</strong> l'anniversaire de ${name} ${surname} !</p>`;
  } else if (daysBeforeBirthday === 1) {
    subject = `[TEST] Rappel: Anniversaire à venir demain !`;
    textContent = `[TEST] Rappelez-vous que demain est l'anniversaire de ${name} ${surname} !`;
    htmlContent = `<p><strong>[EMAIL DE TEST]</strong></p><p>Rappelez-vous que <strong>demain</strong> est l'anniversaire de ${name} ${surname} !</p>`;
  } else {
    subject = `[TEST] Rappel: Anniversaire à venir dans ${daysBeforeBirthday} jours !`;
    textContent = `[TEST] Rappelez-vous que dans ${daysBeforeBirthday} jours ce sera l'anniversaire de ${name} ${surname} !`;
    htmlContent = `<p><strong>[EMAIL DE TEST]</strong></p><p>Rappelez-vous que dans <strong>${daysBeforeBirthday} jours</strong> ce sera l'anniversaire de ${name} ${surname} !</p>`;
  }

  const encodedEmail = encodeURIComponent(email);
  const unsubscribeAllLink = `${process.env.FRONTEND_URL}/api/unsubscribe?email=${encodedEmail}`;
  const unsubscribeSpecificLink = `${process.env.FRONTEND_URL}/api/unsubscribe?email=${encodedEmail}&dateid=${dateId}`;

  htmlContent += `
    <p style="margin-top: 20px; padding-top: 10px; border-top: 1px solid #ddd; color: #777; font-size: 12px;">
      Options de notification :
      <ul style="margin-top: 5px;">
        <li><a href="${unsubscribeSpecificLink}">Ne plus recevoir de notifications pour ${name} ${surname}</a></li>
        <li><a href="${unsubscribeAllLink}">Ne plus recevoir aucune notification</a></li>
      </ul>
    </p>
  `;

  const mailOptions = {
    from: process.env.EMAIL_BRTHDAY,
    to: email,
    subject: subject,
    text: textContent,
    html: htmlContent,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ Email envoyé avec succès à ${email}`);
    console.log(`   MessageId: ${info.MessageId || info.messageId}`);
    return true;
  } catch (error) {
    console.error(`❌ Erreur lors de l'envoi à ${email}:`, error.message);
    return false;
  }
}

// Fonction principale de test
async function testEmailNotifications() {
  console.log("\n╔════════════════════════════════════════════╗");
  console.log("║   TEST MANUEL - EMAILS D'ANNIVERSAIRE     ║");
  console.log("╚════════════════════════════════════════════╝\n");

  try {
    // Connexion à MongoDB
    console.log("📡 Connexion à MongoDB...");
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connecté à MongoDB\n");

    // Récupérer toutes les dates avec leurs propriétaires
    const dateList = await dateModel.find().populate("owner");
    console.log(`📅 ${dateList.length} date(s) trouvée(s) dans la base\n`);

    if (dateList.length === 0) {
      console.log(
        "⚠️  Aucune date trouvée. Ajoutez des anniversaires dans votre application.\n"
      );
      await mongoose.connection.close();
      return;
    }

    // Afficher toutes les dates et proposer l'envoi
    console.log(
      "═══════════════════════════════════════════════════════════════"
    );

    let emailsSentCount = 0;

    for (let i = 0; i < dateList.length; i++) {
      const dateItem = dateList[i];
      const birthday = new Date(dateItem.date);
      const today = new Date();

      console.log(
        `\n[${i + 1}/${dateList.length}] ${dateItem.name} ${
          dateItem.surname || ""
        }`
      );
      console.log(`    Anniversaire: ${birthday.toLocaleDateString("fr-FR")}`);

      // Vérifications
      const issues = [];

      if (!dateItem.owner) {
        issues.push("❌ Pas de propriétaire");
      } else {
        if (!dateItem.owner.email) {
          issues.push("❌ Propriétaire sans email");
        } else {
          console.log(`    Email: ${dateItem.owner.email}`);
        }
        if (dateItem.owner.receiveBirthdayEmails === false) {
          issues.push("⚠️  Notifications désactivées (utilisateur)");
        }
      }

      if (dateItem.receiveNotifications === false) {
        issues.push("⚠️  Notifications désactivées (date)");
      }

      if (issues.length > 0) {
        console.log(`    Status: ${issues.join(", ")}`);
        console.log("    ⏭️  Passage à la suivante");
        continue;
      }

      // Calculer les jours jusqu'à l'anniversaire
      const birthdayThisYear = new Date(
        today.getFullYear(),
        birthday.getMonth(),
        birthday.getDate()
      );
      const daysUntilBirthday = Math.ceil(
        (birthdayThisYear - today) / (1000 * 60 * 60 * 24)
      );

      console.log(`    Jours jusqu'à l'anniversaire: ${daysUntilBirthday}`);
      console.log(`    Status: ✅ Prêt pour l'envoi`);

      // Proposer d'envoyer un email de test
      console.log(`\n    📧 Envoi d'un email de TEST...`);

      // Envoyer un email comme si c'était demain
      const testDays = 1; // Vous pouvez changer cette valeur (0 = aujourd'hui, 1 = demain, etc.)
      const success = await sendTestEmail(
        dateItem.owner.email,
        dateItem.name,
        dateItem.surname || "",
        testDays,
        dateItem._id
      );

      if (success) {
        emailsSentCount++;
      }
    }

    console.log(
      "\n═══════════════════════════════════════════════════════════════"
    );
    console.log(
      `\n📊 RÉSUMÉ: ${emailsSentCount} email(s) envoyé(s) sur ${dateList.length} date(s)`
    );

    // Fermer la connexion
    await mongoose.connection.close();
    console.log("\n✅ Test terminé. Connexion MongoDB fermée.\n");
  } catch (error) {
    console.error("\n❌ ERREUR:", error.message);
    console.error(error.stack);

    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
    }
  }
}

// Fonction pour envoyer à un email spécifique
async function sendToSpecificEmail(targetEmail) {
  console.log(`\n🎯 Envoi à l'email spécifique: ${targetEmail}\n`);

  try {
    await mongoose.connect(process.env.MONGO_URI);

    const user = await userModel.findOne({ email: targetEmail });
    if (!user) {
      console.log(`❌ Aucun utilisateur trouvé avec l'email: ${targetEmail}`);
      await mongoose.connection.close();
      return;
    }

    const dateList = await dateModel.find({ owner: user._id });
    console.log(
      `📅 ${dateList.length} date(s) trouvée(s) pour cet utilisateur\n`
    );

    for (const dateItem of dateList) {
      console.log(`Envoi pour: ${dateItem.name} ${dateItem.surname || ""}`);
      await sendTestEmail(
        targetEmail,
        dateItem.name,
        dateItem.surname || "",
        1,
        dateItem._id
      );
    }

    await mongoose.connection.close();
    console.log("\n✅ Terminé\n");
  } catch (error) {
    console.error("❌ Erreur:", error.message);
  }
}

// Exécution
const args = process.argv.slice(2);

if (args.length > 0 && args[0].includes("@")) {
  // Si un email est passé en argument
  sendToSpecificEmail(args[0]);
} else {
  // Test normal
  testEmailNotifications();
}
