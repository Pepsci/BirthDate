#!/usr/bin/env node
/**
 * Vérifie que les fichiers de traduction fr et en ont les mêmes clés,
 * pour le front web et pour le mobile.
 *
 * Usage :
 *   node scripts/check-locales.js           → rapport, ne bloque pas
 *   node scripts/check-locales.js --strict  → code de sortie 1 s'il manque
 *                                             des clés (à utiliser quand
 *                                             l'anglais sera activé)
 *
 * Le français est la référence : une clé présente en fr et absente en en
 * est "à traduire" ; une clé présente en en mais pas en fr est "orpheline".
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const APPS = {
  front: "front/src/i18n/locales",
  mobile: "mobile/src/i18n/locales",
};
const REF = "fr";
const TARGET = "en";
const strict = process.argv.includes("--strict");

function flatten(obj, prefix = "") {
  return Object.entries(obj).flatMap(([k, v]) => {
    const key = prefix ? `${prefix}.${k}` : k;
    return v && typeof v === "object" ? flatten(v, key) : [key];
  });
}

function loadKeys(file) {
  if (!fs.existsSync(file)) return null;
  return new Set(flatten(JSON.parse(fs.readFileSync(file, "utf8"))));
}

let problems = 0;

for (const [app, dir] of Object.entries(APPS)) {
  const refDir = path.join(ROOT, dir, REF);
  if (!fs.existsSync(refDir)) continue;
  console.log(`\n▶ ${app}`);

  for (const file of fs.readdirSync(refDir).filter((f) => f.endsWith(".json"))) {
    const ns = file.replace(".json", "");
    const refKeys = loadKeys(path.join(refDir, file));
    const targetKeys = loadKeys(path.join(ROOT, dir, TARGET, file));

    if (!targetKeys) {
      console.log(`  ✗ ${ns} : fichier ${TARGET}/${file} absent`);
      problems++;
      continue;
    }

    const missing = [...refKeys].filter((k) => !targetKeys.has(k));
    const orphans = [...targetKeys].filter((k) => !refKeys.has(k));

    if (!missing.length && !orphans.length) {
      console.log(`  ✓ ${ns} (${refKeys.size} clés)`);
      continue;
    }
    missing.forEach((k) => console.log(`  ✗ ${ns} : "${k}" à traduire en ${TARGET}`));
    orphans.forEach((k) => console.log(`  ⚠ ${ns} : "${k}" orpheline (absente en ${REF})`));
    problems += missing.length;
  }
}

console.log(problems ? `\n${problems} problème(s).` : "\nTout est aligné.");
process.exit(strict && problems ? 1 : 0);
