/**
 * migrate-namedays.js
 *
 * Recalcule le champ `nameday` de toutes les dates et tous les users
 * en utilisant le nouveau namedays-fr-by-name.json
 *
 * Usage :
 *   node migrate-namedays.js          → dry-run (affiche sans modifier)
 *   node migrate-namedays.js --apply  → applique les modifications
 */

require("dotenv").config();
const mongoose = require("mongoose");
const { findNameDay } = require("../utils/namedayHelper");

const DateModel = require("../models/date.model");
const UserModel = require("../models/user.model");

const DRY_RUN = !process.argv.includes("--apply");

async function migrate() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("✅ Connecté à MongoDB\n");
  console.log(
    DRY_RUN ? "🔍 MODE DRY-RUN (aucune modification)\n" : "🚀 MODE APPLY\n",
  );

  // ─── 1. Dates ──────────────────────────────────────────────────────────────
  console.log("══════════════════════════════════");
  console.log("📅 Migration des DATES");
  console.log("══════════════════════════════════");

  const dates = await DateModel.find({ linkedUser: null }); // seulement les dates manuelles
  let dateUpdated = 0,
    dateSkipped = 0,
    dateCleared = 0;

  for (const date of dates) {
    const newNameday = findNameDay(date.name);
    const oldNameday = date.nameday || null;

    if (newNameday === oldNameday) {
      dateSkipped++;
      continue;
    }

    console.log(
      `  ${date.name.padEnd(20)} ${oldNameday || "(vide)".padEnd(6)} → ${newNameday || "(vide)"}`,
    );

    if (!DRY_RUN) {
      await DateModel.findByIdAndUpdate(date._id, { nameday: newNameday });
    }

    if (newNameday) dateUpdated++;
    else dateCleared++;
  }

  console.log(
    `\n  ✅ ${dateUpdated} mis à jour, ${dateCleared} vidés, ${dateSkipped} inchangés\n`,
  );

  // ─── 2. Users ──────────────────────────────────────────────────────────────
  console.log("══════════════════════════════════");
  console.log("👤 Migration des USERS");
  console.log("══════════════════════════════════");

  const users = await UserModel.find({ deletedAt: { $exists: false } });
  let userUpdated = 0,
    userSkipped = 0,
    userCleared = 0;

  for (const user of users) {
    const newNameday = findNameDay(user.name);
    const oldNameday = user.nameday || null;

    if (newNameday === oldNameday) {
      userSkipped++;
      continue;
    }

    console.log(
      `  ${user.name.padEnd(20)} ${oldNameday || "(vide)".padEnd(6)} → ${newNameday || "(vide)"}`,
    );

    if (!DRY_RUN) {
      await UserModel.findByIdAndUpdate(user._id, { nameday: newNameday });
    }

    if (newNameday) userUpdated++;
    else userCleared++;
  }

  console.log(
    `\n  ✅ ${userUpdated} mis à jour, ${userCleared} vidés, ${userSkipped} inchangés\n`,
  );

  // ─── Résumé ────────────────────────────────────────────────────────────────
  console.log("══════════════════════════════════");
  console.log("📊 RÉSUMÉ");
  console.log("══════════════════════════════════");
  console.log(`  Dates : ${dateUpdated + dateCleared} changements`);
  console.log(`  Users : ${userUpdated + userCleared} changements`);

  if (DRY_RUN) {
    console.log("\n⚠️  DRY-RUN — rien n'a été modifié.");
    console.log("   Relance avec --apply pour appliquer :\n");
    console.log("   node migrate-namedays.js --apply\n");
  } else {
    console.log("\n✅ Migration terminée !\n");
  }

  await mongoose.disconnect();
}

migrate().catch((err) => {
  console.error("❌ Erreur migration:", err);
  process.exit(1);
});
