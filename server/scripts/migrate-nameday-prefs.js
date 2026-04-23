// migrate-nameday-prefs.js
// Script de migration pour initialiser namedayPreferences sur les dates existantes avec nameday

require("dotenv").config();
const mongoose = require("mongoose");
const dateModel = require("../models/date.model");

async function migrate() {
  try {
    // Connexion à MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connecté à MongoDB");

    // Trouver toutes les dates avec nameday mais sans namedayPreferences
    const datesToMigrate = await dateModel.find({
      nameday: { $exists: true, $ne: null },
      namedayPreferences: { $exists: false },
    });

    console.log(`📊 ${datesToMigrate.length} dates à migrer`);

    if (datesToMigrate.length === 0) {
      console.log("✅ Aucune migration nécessaire");
      process.exit(0);
    }

    // Initialiser namedayPreferences pour chaque date
    const result = await dateModel.updateMany(
      {
        nameday: { $exists: true, $ne: null },
        namedayPreferences: { $exists: false },
      },
      {
        $set: {
          namedayPreferences: {
            timings: [1], // 1 jour avant par défaut
            notifyOnNameday: true, // Jour de la fête par défaut
          },
        },
      },
    );

    console.log(`✅ Migration terminée !`);
    console.log(`   - ${result.matchedCount} dates trouvées`);
    console.log(`   - ${result.modifiedCount} dates migrées`);

    // Afficher un exemple de date migrée
    const example = await dateModel.findOne({
      nameday: { $exists: true },
    });

    if (example) {
      console.log("\n📝 Exemple de date migrée :");
      console.log(`   Nom: ${example.name}`);
      console.log(`   Fête: ${example.nameday}`);
      console.log(
        `   Préférences: ${JSON.stringify(example.namedayPreferences, null, 2)}`,
      );
    }

    process.exit(0);
  } catch (error) {
    console.error("❌ Erreur lors de la migration:", error);
    process.exit(1);
  }
}

migrate();
