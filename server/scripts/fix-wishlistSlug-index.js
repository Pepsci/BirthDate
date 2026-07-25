/**
 * Migration ponctuelle : corrige l'index unique sur `wishlistPublicSlug`.
 *
 * Problème : l'ancien index `{ wishlistPublicSlug: 1 } unique/sparse` traitait
 * tous les documents avec `wishlistPublicSlug: null` comme des doublons, ce qui
 * bloquait la création de nouveaux comptes (E11000).
 *
 * Fix : on supprime l'ancien index et on le recrée en "partial" — unique
 * uniquement quand le slug est une vraie chaîne.
 *
 * Usage : node scripts/fix-wishlistSlug-index.js
 * (nécessite MONGO_URI dans l'environnement / .env)
 */
require("dotenv").config();
const mongoose = require("mongoose");

async function run() {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error("MONGO_URI manquant");

  await mongoose.connect(uri);
  const coll = mongoose.connection.db.collection("users");

  const indexes = await coll.indexes();
  console.log("Index actuels :", indexes.map((i) => i.name));

  if (indexes.some((i) => i.name === "wishlistPublicSlug_1")) {
    await coll.dropIndex("wishlistPublicSlug_1");
    console.log("→ Ancien index wishlistPublicSlug_1 supprimé.");
  } else {
    console.log("→ Aucun ancien index wishlistPublicSlug_1 à supprimer.");
  }

  // Nettoie les null explicites laissés par l'ancien `default: null`
  const res = await coll.updateMany(
    { wishlistPublicSlug: null },
    { $unset: { wishlistPublicSlug: "" } }
  );
  console.log(`→ ${res.modifiedCount} documents nettoyés (null retiré).`);

  await coll.createIndex(
    { wishlistPublicSlug: 1 },
    {
      unique: true,
      partialFilterExpression: { wishlistPublicSlug: { $type: "string" } },
    }
  );
  console.log("→ Nouvel index partiel créé. ✅");

  await mongoose.disconnect();
  console.log("Terminé.");
}

run().catch((err) => {
  console.error("Échec de la migration :", err);
  process.exit(1);
});
