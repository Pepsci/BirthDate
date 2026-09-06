// migrate-log-retention.js
//
// Fait passer le journal (collection `logs`) d'une purge uniforme à 365 jours
// à une purge par document.
//
// ── Pourquoi ────────────────────────────────────────────────────────────────
// L'index TTL historique portait sur `createdAt` avec expireAfterSeconds
// 31536000 : TOUT était effacé à un an, sans distinction. Or les actions à
// conséquence durable — annulation d'événement, transfert d'organisation,
// remboursement de cagnotte — doivent rester consultables bien au-delà : ce
// sont elles qu'on ressort le jour où quelqu'un conteste.
//
// Le nouveau schéma indexe `expiresAt` avec expireAfterSeconds: 0. MongoDB
// ignore les documents dont le champ TTL est absent ou nul : une entrée écrite
// sans `expiresAt` n'expire donc jamais. C'est ce que fait services/auditLog.js
// pour les actions listées dans PERMANENT_ACTIONS.
//
// ── Ce que fait ce script ───────────────────────────────────────────────────
//   1. backfill : expiresAt = createdAt + 365 j sur les documents existants,
//      pour qu'ils gardent EXACTEMENT la durée de vie qu'ils avaient ;
//   2. suppression de l'ancien index sur createdAt.
//
// ⚠️ L'ordre compte. Tant que l'ancien index existe, il purge tout à un an et
// `expiresAt` ne sert à rien ; si on le supprimait AVANT le backfill, les
// anciens documents deviendraient éternels. On remplit d'abord, on supprime
// ensuite.
//
// ⚠️ À lancer une seule fois, sur chaque environnement :
//     node server/scripts/migrate-log-retention.js
//   Ajouter --dry-run pour voir ce qui serait fait sans rien écrire.

require("dotenv").config();
const mongoose = require("mongoose");
const Log = require("../models/log.model");

const DRY_RUN = process.argv.includes("--dry-run");
const YEAR_MS = 365 * 24 * 60 * 60 * 1000;

async function migrate() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log(`✅ Connecté à MongoDB${DRY_RUN ? " (DRY RUN)" : ""}`);

    const collection = Log.collection;

    // ── 1. Backfill ─────────────────────────────────────────────────────────
    const toFill = await collection.countDocuments({
      $or: [{ expiresAt: { $exists: false } }, { expiresAt: null }],
    });
    console.log(`📊 ${toFill} document(s) sans expiresAt`);

    if (toFill > 0 && !DRY_RUN) {
      const res = await collection.updateMany(
        { $or: [{ expiresAt: { $exists: false } }, { expiresAt: null }] },
        [
          {
            $set: {
              expiresAt: { $add: ["$createdAt", YEAR_MS] },
            },
          },
        ],
      );
      console.log(`✏️  ${res.modifiedCount} document(s) datés d'expiration`);
    }

    // ── 2. Suppression de l'ancien index TTL ────────────────────────────────
    const indexes = await collection.indexes();
    const old = indexes.find(
      (i) =>
        i.key &&
        i.key.createdAt === 1 &&
        Object.keys(i.key).length === 1 &&
        i.expireAfterSeconds !== undefined,
    );

    if (!old) {
      console.log("ℹ️  Aucun index TTL sur createdAt — déjà migré.");
    } else {
      console.log(
        `🔎 Ancien index trouvé : ${old.name} (expireAfterSeconds=${old.expireAfterSeconds})`,
      );
      if (!DRY_RUN) {
        await collection.dropIndex(old.name);
        console.log(`🗑️  Index ${old.name} supprimé`);
      }
    }

    // ── Contrôle ────────────────────────────────────────────────────────────
    const after = await collection.indexes();
    const ttl = after.filter((i) => i.expireAfterSeconds !== undefined);
    console.log(
      "📋 Index TTL restants :",
      ttl.map((i) => `${i.name}(${JSON.stringify(i.key)})`).join(", ") ||
        "aucun",
    );

    console.log(DRY_RUN ? "✅ Dry run terminé" : "✅ Migration terminée");
  } catch (err) {
    console.error("❌ Erreur de migration :", err);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

migrate();
