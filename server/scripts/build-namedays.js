/**
 * build-namedays.js
 *
 * Génère les index de fêtes à partir du fichier maison data/namedays/<pays>.json.
 *
 *   node scripts/build-namedays.js        → FR par défaut
 *   node scripts/build-namedays.js fr
 *
 * Source (éditée à la main) :
 *   { days: { "MM-DD": ["Prénom", ...] }, aliases: { "Variante": "Prénom" } }
 *
 * Sorties (générées, ne pas éditer) :
 *   data/namedays-<pays>-by-name.json   { "michel": "09-29", ... }
 *   data/namedays-<pays>-by-date.json   { "09-29": ["Michel", ...] }
 *   ../mobile/src/data/namedays-<pays>-by-name.json  (copie pour le mode local)
 *
 * Le script refuse de générer si la source est incohérente :
 * prénom présent à deux dates, alias vers un prénom inconnu, date invalide.
 */

const fs = require("fs");
const path = require("path");
const { nameKeys } = require("../utils/namedayNormalize");

const country = (process.argv[2] || "fr").toLowerCase();
const DATA = path.join(__dirname, "../data");
const MOBILE_DATA = path.join(__dirname, "../../mobile/src/data");
const src = JSON.parse(
  fs.readFileSync(path.join(DATA, "namedays", `${country}.json`), "utf8"),
);

const errors = [];
const byName = {};
const byDate = {};
const owner = {}; // clé normalisée → prénom qui l'a posée (pour les messages d'erreur)

function addKey(label, date) {
  for (const key of nameKeys(label)) {
    if (byName[key] && byName[key] !== date) {
      errors.push(
        `"${label}" (${date}) entre en collision avec "${owner[key]}" (${byName[key]})`,
      );
      continue;
    }
    byName[key] = date;
    owner[key] = label;
  }
}

// 1. Les jours
for (const [date, names] of Object.entries(src.days)) {
  const m = date.match(/^(\d{2})-(\d{2})$/);
  const d = m && new Date(2024, +m[1] - 1, +m[2]); // 2024 : bissextile
  if (!d || d.getMonth() + 1 !== +m[1] || d.getDate() !== +m[2]) {
    errors.push(`Date invalide : ${date}`);
    continue;
  }
  byDate[date] = names;
  for (const name of names) addKey(name, date);
}

// 2. Les alias (variante → prénom canonique)
for (const [alias, canonical] of Object.entries(src.aliases || {})) {
  const [key] = nameKeys(canonical);
  const date = byName[key];
  if (!date) {
    errors.push(`Alias "${alias}" → "${canonical}" : prénom canonique inconnu`);
    continue;
  }
  addKey(alias, date);
}

if (errors.length) {
  console.error(`❌ ${errors.length} erreur(s) dans namedays/${country}.json :`);
  errors.forEach((e) => console.error("   - " + e));
  process.exit(1);
}

const sortedByName = Object.fromEntries(
  Object.entries(byName).sort(([a], [b]) => a.localeCompare(b, "fr")),
);
const sortedByDate = Object.fromEntries(
  Object.entries(byDate).sort(([a], [b]) => a.localeCompare(b)),
);

const write = (file, data) =>
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + "\n");

write(path.join(DATA, `namedays-${country}-by-name.json`), sortedByName);
write(path.join(DATA, `namedays-${country}-by-date.json`), sortedByDate);
if (fs.existsSync(MOBILE_DATA)) {
  write(path.join(MOBILE_DATA, `namedays-${country}-by-name.json`), sortedByName);
}

console.log(
  `✅ ${country.toUpperCase()} : ${Object.keys(byDate).length} jours, ` +
    `${Object.keys(sortedByName).length} clés de recherche générées.`,
);
