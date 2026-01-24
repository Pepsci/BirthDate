// scripts/syncFriendsBirthdays.js
// Script ponctuel pour synchroniser toutes les dates d'anniversaire existantes

require("dotenv").config(); // 👈 AJOUTÉ pour charger les variables d'environnement

const mongoose = require("mongoose");
const User = require("../models/user.model");
const Friend = require("../models/friend.model");
const DateModel = require("../models/date.model");

async function syncAllFriendsBirthdays() {
  try {
    console.log("🔄 Début de la synchronisation des dates d'anniversaire...\n");

    // Récupérer toutes les amitiés acceptées
    const friendships = await Friend.find({ status: "accepted" });
    console.log(`👥 ${friendships.length} amitiés trouvées\n`);

    let updatedCount = 0;
    let errorCount = 0;
    let notFoundCount = 0;

    for (const friendship of friendships) {
      try {
        // Récupérer les deux utilisateurs
        const user1 = await User.findById(friendship.user);
        const user2 = await User.findById(friendship.friend);

        if (!user1 || !user2) {
          console.log(
            `⚠️  Utilisateur manquant pour l'amitié ${friendship._id}`,
          );
          notFoundCount++;
          continue;
        }

        // 1️⃣ Mettre à jour la date de user1 chez user2
        if (user1.birthDate) {
          const date1 = await DateModel.findOneAndUpdate(
            {
              owner: user2._id,
              linkedUser: user1._id,
            },
            {
              date: user1.birthDate,
              name: user1.name,
              surname: user1.surname || "",
            },
            { new: true },
          );

          if (date1) {
            console.log(
              `✅ ${user1.name} → ${user2.name}: ${user1.birthDate.toLocaleDateString()}`,
            );
            updatedCount++;
          } else {
            console.log(
              `⚠️  Aucune date trouvée: ${user1.name} chez ${user2.name}`,
            );
            notFoundCount++;
          }
        }

        // 2️⃣ Mettre à jour la date de user2 chez user1
        if (user2.birthDate) {
          const date2 = await DateModel.findOneAndUpdate(
            {
              owner: user1._id,
              linkedUser: user2._id,
            },
            {
              date: user2.birthDate,
              name: user2.name,
              surname: user2.surname || "",
            },
            { new: true },
          );

          if (date2) {
            console.log(
              `✅ ${user2.name} → ${user1.name}: ${user2.birthDate.toLocaleDateString()}`,
            );
            updatedCount++;
          } else {
            console.log(
              `⚠️  Aucune date trouvée: ${user2.name} chez ${user1.name}`,
            );
            notFoundCount++;
          }
        }
      } catch (error) {
        console.error(
          `❌ Erreur pour l'amitié ${friendship._id}:`,
          error.message,
        );
        errorCount++;
      }
    }

    console.log("\n" + "=".repeat(50));
    console.log("📊 RÉSUMÉ DE LA SYNCHRONISATION");
    console.log("=".repeat(50));
    console.log(`✅ Dates mises à jour: ${updatedCount}`);
    console.log(`⚠️  Dates non trouvées: ${notFoundCount}`);
    console.log(`❌ Erreurs: ${errorCount}`);
    console.log("=".repeat(50) + "\n");
  } catch (error) {
    console.error("❌ Erreur globale:", error);
  }
}

// Si le script est exécuté directement
if (require.main === module) {
  // Connexion à la base de données
  mongoose
    .connect(process.env.MONGO_URI)
    .then(() => {
      console.log("✅ Connecté à MongoDB\n");
      return syncAllFriendsBirthdays();
    })
    .then(() => {
      console.log("✅ Synchronisation terminée");
      process.exit(0);
    })
    .catch((error) => {
      console.error("❌ Erreur:", error);
      process.exit(1);
    });
}

module.exports = { syncAllFriendsBirthdays };
