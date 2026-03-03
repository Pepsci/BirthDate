require("dotenv").config();
const mongoose = require("mongoose");
const userModel = require("../models/user.model");
const { findNameDay } = require("../utils/namedayHelper");

async function migrateNamedays() {
  try {
    // Connexion à la DB
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB");

    // Récupérer tous les utilisateurs sans nameday
    const users = await userModel.find({
      nameday: { $in: [null, undefined] },
    });

    console.log(`📊 Found ${users.length} users without nameday`);

    let updated = 0;
    let notFound = 0;

    for (const user of users) {
      const nameday = findNameDay(user.name);

      if (nameday) {
        await userModel.findByIdAndUpdate(user._id, { nameday });
        console.log(`✅ ${user.name} → ${nameday}`);
        updated++;
      } else {
        console.log(`⚠️  ${user.name} → No nameday found`);
        notFound++;
      }
    }

    console.log("\n📊 Migration Summary:");
    console.log(`✅ Updated: ${updated}`);
    console.log(`⚠️  Not found: ${notFound}`);
    console.log(`📊 Total: ${users.length}`);

    await mongoose.connection.close();
    console.log("\n✅ Migration completed and connection closed");
  } catch (error) {
    console.error("❌ Migration error:", error);
    process.exit(1);
  }
}

migrateNamedays();
