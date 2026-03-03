require("dotenv").config();
const mongoose = require("mongoose");
const DateModel = require("../models/date.model");

async function cleanEmptyDates() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB");

    // Supprimer les cartes avec name vide, null, ou seulement des espaces
    const result = await DateModel.deleteMany({
      $or: [
        { name: null },
        { name: "" },
        { name: /^\s*$/ }, // Seulement des espaces
        { name: { $exists: false } },
      ],
      linkedUser: null, // Seulement les cartes manuelles
    });

    console.log(`🗑️  Deleted ${result.deletedCount} empty dates`);

    await mongoose.connection.close();
    console.log("✅ Cleanup completed");
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

cleanEmptyDates();
