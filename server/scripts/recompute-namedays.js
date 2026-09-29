/**
 * recompute-namedays.js
 *
 * Recalcule les fêtes stockées en base après le passage au fichier maison
 * (data/namedays/fr.json) et la suppression du repli US.
 *
 * Pourquoi : la fête est calculée UNE fois, à la création de la carte ou du
 * compte, puis figée dans `nameday`. Changer le calendrier ne touche donc pas
 * les cartes existantes tant qu'on ne les recalcule pas.
 *
 * Règle de sécurité — on ne touche JAMAIS une fête choisie à la main :
 *   - namedaySource = "manual"           → on laisse
 *   - namedaySource = "auto"             → on recalcule
 *   - pas encore de namedaySource (documents d'avant ce champ), on devine UNE fois :
 *       · fête vide                          → auto, on calcule
 *       · fête = ce que l'ANCIEN calcul      → auto, on recalcule
 *         aurait donné (FR puis repli US)      (Mia 29/09 → 15/08)
 *       · fête différente de l'ancien calcul → manuelle, on laisse
 *     et on enregistre la source trouvée, pour ne plus jamais deviner.
 *
 * Nettoie aussi les espaces autour de name / surname (cartes uniquement).
 *
 *   node scripts/recompute-namedays.js           → simulation, n'écrit rien
 *   node scripts/recompute-namedays.js --apply   → écrit en base
 */

require("dotenv").config();
const mongoose = require("mongoose");
const DateModel = require("../models/date.model");
const User = require("../models/user.model");
const { findNameDay } = require("../utils/namedayHelper");

const APPLY = process.argv.includes("--apply");

// ── Ancien calcul, reproduit à l'identique (index figés dans data-legacy/) ──
const LEGACY_FR = require("./data-legacy/namedays-fr-by-name.json");
const LEGACY_US = require("./data-legacy/namedays-us-by-name.json");

function legacyCandidates(firstName) {
  const lower = firstName.toLowerCase().trim();
  const norm = lower
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z-]/g, "");
  const c = new Set([lower, norm]);
  if (lower.includes("-")) {
    c.add(lower.split("-")[0]);
    c.add(norm.split("-")[0]);
  }
  return [...c].filter(Boolean);
}

function legacyFindNameDay(firstName) {
  if (!firstName) return null;
  const c = legacyCandidates(firstName);
  for (const k of c) if (LEGACY_FR[k]) return LEGACY_FR[k];
  for (const k of c) if (LEGACY_US[k]) return LEGACY_US[k];
  return null;
}

// ── Décision pour un document ──
function decide(name, stored, source) {
  const current = stored || null;
  const next = findNameDay(name);

  let resolvedSource = source;
  if (!resolvedSource) {
    resolvedSource =
      !current || current === legacyFindNameDay(name) ? "auto" : "manual";
  }

  if (resolvedSource === "manual") {
    return { action: "manual", from: current, suggested: next, source: "manual" };
  }
  if (current === next) return { action: "same", source: "auto" };
  return { action: "update", from: current, to: next, source: "auto" };
}

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log(`✅ Connecté — mode ${APPLY ? "ÉCRITURE" : "SIMULATION (--apply pour écrire)"}\n`);

  const stats = { updated: 0, cleared: 0, manual: 0, trimmed: 0 };
  const manual = [];

  // 1. Cartes (dates)
  const dates = await DateModel.find(
    {},
    "name surname nameday namedaySource linkedUser",
  ).lean();
  for (const d of dates) {
    const set = {};
    const unset = {};

    const name = (d.name || "").trim();
    if (d.name && d.name !== name) set.name = name;
    if (d.surname && d.surname !== d.surname.trim()) set.surname = d.surname.trim();
    if (set.name !== undefined || set.surname !== undefined) stats.trimmed++;

    // Carte liée sans prénom propre : la fête vient du compte lié, on n'y touche pas
    if (name) {
      const r = decide(name, d.nameday, d.namedaySource);
      if (d.namedaySource !== r.source) set.namedaySource = r.source;
      if (r.action === "update") {
        if (r.to) { set.nameday = r.to; stats.updated++; }
        else { unset.nameday = ""; stats.cleared++; }
        console.log(`  carte  ${name.padEnd(18)} ${r.from || "—"} → ${r.to || "pas de fête"}`);
      } else if (r.action === "manual" && r.from !== r.suggested) {
        stats.manual++;
        manual.push(`carte  ${name} : garde ${r.from} (le calendrier dirait ${r.suggested || "pas de fête"})`);
      }
    }

    if (APPLY && (Object.keys(set).length || Object.keys(unset).length)) {
      const update = {};
      if (Object.keys(set).length) update.$set = set;
      if (Object.keys(unset).length) update.$unset = unset;
      await DateModel.updateOne({ _id: d._id }, update);
    }
  }

  // 2. Comptes utilisateurs (leur propre fête)
  const users = await User.find(
    { deletedAt: { $exists: false } },
    "name nameday namedaySource",
  ).lean();
  for (const u of users) {
    const name = (u.name || "").trim();
    if (!name) continue;
    const r = decide(name, u.nameday, u.namedaySource);
    const set = {};
    if (u.namedaySource !== r.source) set.namedaySource = r.source;
    if (r.action === "update") {
      console.log(`  compte ${name.padEnd(18)} ${r.from || "—"} → ${r.to || "pas de fête"}`);
      r.to ? stats.updated++ : stats.cleared++;
      set.nameday = r.to || null;
    }
    if (APPLY && Object.keys(set).length) {
      await User.updateOne({ _id: u._id }, { $set: set });
    }
    if (r.action === "manual" && r.from !== r.suggested) {
      stats.manual++;
      manual.push(`compte ${name} : garde ${r.from} (le calendrier dirait ${r.suggested || "pas de fête"})`);
    }
  }

  if (manual.length) {
    console.log("\n✋ Fêtes saisies à la main, laissées telles quelles :");
    manual.forEach((m) => console.log("  " + m));
  }

  console.log(
    `\n📊 ${dates.length} cartes, ${users.length} comptes — ` +
      `${stats.updated} fête(s) corrigée(s), ${stats.cleared} retirée(s), ` +
      `${stats.manual} manuelle(s) conservée(s), ${stats.trimmed} prénom(s) nettoyé(s).`,
  );
  if (!APPLY) console.log("ℹ️  Rien n'a été écrit. Relancer avec --apply.");

  await mongoose.disconnect();
}

run().catch((e) => {
  console.error("❌", e);
  process.exit(1);
});
