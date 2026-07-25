/**
 * fixAlmaNameday.js — Corrige la fête de "Alma" mal placée.
 *
 * Contexte : "Alma" n'existait pas dans les données FR, l'app tombait sur le
 * fallback US (namedays-us-by-name.json) qui la place au 21 juillet (07-21).
 * "Alma" a été ajoutée aux données FR au 1er août (08-01). Ce script met à jour
 * les enregistrements DÉJÀ en base (Date + User) qui ont gardé "07-21".
 *
 * Sécurité :
 *  - Ne touche QUE les docs dont le prénom (normalisé) est "alma" ET nameday "07-21".
 *  - Les autres noms au 07-21 (ex. Victor) ne sont jamais modifiés.
 *  - DRY-RUN par défaut : n'écrit rien tant qu'on ne passe pas --apply.
 *
 * Usage (depuis le dossier server/) :
 *   node scripts/fixAlmaNameday.js            # aperçu (dry-run)
 *   node scripts/fixAlmaNameday.js --apply    # applique les modifications
 */
require("dotenv").config();
const mongoose = require("mongoose");
const DateModel = require("../models/date.model");
const User = require("../models/user.model");

const OLD = "07-21";
const NEW = "08-01";
const APPLY = process.argv.includes("--apply");

const norm = (s) =>
  (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();

async function run() {
  if (!process.env.MONGO_URI) {
    console.error("❌ MONGO_URI manquant (vérifie server/.env)");
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI, {
    serverSelectionTimeoutMS: 15000,
  });
  console.log(`✅ Connecté à MongoDB — mode : ${APPLY ? "APPLY" : "DRY-RUN"}`);

  const dates = (await DateModel.find({ nameday: OLD })).filter(
    (d) => norm(d.name) === "alma",
  );
  const users = (await User.find({ nameday: OLD })).filter(
    (u) => norm(u.name) === "alma",
  );

  console.log(`\n📊 Cartes (Date) « Alma » au ${OLD} : ${dates.length}`);
  dates.forEach((d) =>
    console.log(`   - ${d._id} ${d.name} ${d.surname || ""}`),
  );
  console.log(`📊 Comptes (User) « Alma » au ${OLD} : ${users.length}`);
  users.forEach((u) =>
    console.log(`   - ${u._id} ${u.name} ${u.surname || ""}`),
  );

  if (!APPLY) {
    console.log(
      `\nℹ️  DRY-RUN : rien n'a été modifié. Relance avec --apply pour écrire (${OLD} → ${NEW}).`,
    );
  } else {
    let n = 0;
    for (const d of dates) {
      await DateModel.findByIdAndUpdate(d._id, { nameday: NEW });
      n++;
    }
    for (const u of users) {
      await User.findByIdAndUpdate(u._id, { nameday: NEW });
      n++;
    }
    console.log(`\n✅ ${n} enregistrement(s) mis à jour (${OLD} → ${NEW}).`);
  }

  await mongoose.connection.close();
  console.log("✅ Terminé, connexion fermée.");
}

run().catch((e) => {
  console.error("❌ Erreur :", e.message);
  process.exit(1);
});
