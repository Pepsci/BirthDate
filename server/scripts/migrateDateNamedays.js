require("dotenv").config();
const mongoose = require("mongoose");
const DateModel = require("../models/date.model");
const { findNameDay } = require("../utils/namedayHelper");

async function migrateDateNamedays() {
  try {
    // Connexion à la DB
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB");

    // Récupérer toutes les cartes sans nameday ET sans linkedUser (cartes manuelles uniquement)
    const dates = await DateModel.find({
      nameday: { $in: [null, undefined] },
      linkedUser: null, // Seulement les cartes manuelles
    });

    console.log(`📊 Found ${dates.length} manual dates without nameday`);

    let updated = 0;
    let notFound = 0;

    for (const date of dates) {
      const nameday = findNameDay(date.name);

      if (nameday) {
        await DateModel.findByIdAndUpdate(date._id, { nameday });
        console.log(`✅ ${date.name} ${date.surname || ""} → ${nameday}`);
        updated++;
      } else {
        console.log(
          `⚠️  ${date.name} ${date.surname || ""} → No nameday found`,
        );
        notFound++;
      }
    }

    console.log("\n📊 Migration Summary:");
    console.log(`✅ Updated: ${updated}`);
    console.log(`⚠️  Not found: ${notFound}`);
    console.log(`📊 Total: ${dates.length}`);

    await mongoose.connection.close();
    console.log("\n✅ Migration completed and connection closed");
  } catch (error) {
    console.error("❌ Migration error:", error);
    process.exit(1);
  }
}

migrateDateNamedays();
