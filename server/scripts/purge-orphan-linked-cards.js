// purge-orphan-linked-cards.js
//
// Nettoyage unique : supprime les cartes anniversaire dont `linkedUser`
// pointe vers un compte supprimé (soft delete) ou déjà purgé.
//
// ── Pourquoi ────────────────────────────────────────────────────────────────
// Avant le correctif de DELETE /users/:id, supprimer son compte laissait chez
// les autres la carte qu'ils avaient de lui. Le correctif empêche que ça se
// reproduise ; ce script efface les cartes orphelines déjà en base.
//
//     node server/scripts/purge-orphan-linked-cards.js --dry-run   # voir
//     node server/scripts/purge-orphan-linked-cards.js             # supprimer

require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const mongoose = require("mongoose");
const DateModel = require("../models/date.model");
const User = require("../models/user.model");
const Friend = require("../models/friend.model");
const { removeCardPhotoFiles } = require("../config/cardPhotoStorage");

if (!process.env.MONGO_URI) {
  console.error("❌ MONGO_URI introuvable. Vérifie que server/.env existe et le contient.");
  process.exit(1);
}

const DRY_RUN = process.argv.includes("--dry-run");

async function run() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log(`✅ Connecté à MongoDB${DRY_RUN ? " (DRY RUN)" : ""}`);

    const linkedIds = await DateModel.distinct("linkedUser", { linkedUser: { $ne: null } });
    const alive = await User.find({ _id: { $in: linkedIds }, deletedAt: null }).distinct("_id");
    const aliveSet = new Set(alive.map(String));
    const deadIds = linkedIds.filter((id) => !aliveSet.has(String(id)));

    const orphans = await DateModel.find({ linkedUser: { $in: deadIds } })
      .select("_id name surname owner photo linkedUser");

    console.log(`📊 ${orphans.length} carte(s) orpheline(s) pour ${deadIds.length} compte(s) disparu(s)`);
    for (const c of orphans) {
      console.log(`   • ${c.name || "?"} ${c.surname || ""} — carte ${c._id} (owner ${c.owner}, linkedUser ${c.linkedUser})`);
    }

    if (DRY_RUN || orphans.length === 0) return;

    const ids = orphans.map((c) => c._id);
    await DateModel.deleteMany({ _id: { $in: ids } });
    // Amitiés résiduelles qui pointeraient encore vers ces cartes
    await Friend.updateMany({ linkedDate: { $in: ids } }, { $set: { linkedDate: null } });
    await Promise.all(
      orphans.filter((c) => c.photo).map((c) => removeCardPhotoFiles(c._id).catch(() => {})),
    );
    console.log(`🗑️  ${ids.length} carte(s) supprimée(s)`);
  } catch (error) {
    console.error("❌ Erreur:", error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

run();
