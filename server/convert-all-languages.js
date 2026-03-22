/**
 * convert-all-languages.js
 */

const fs = require('fs');
const path = require('path');

let raw = fs.readFileSync('./namedays-github.json', 'utf8');
raw = raw.replace(/,(\s*[}\]])/g, '$1');
const data = JSON.parse(raw);

const LANGS = ['fr', 'de', 'es', 'it', 'pl', 'cz', 'sk', 'hu', 'hr', 'se',
               'dk', 'fi', 'bg', 'lt', 'lv', 'ee', 'gr', 'ru', 'us', 'at'];

function pad(n) { return String(n).padStart(2, '0'); }

function normalize(str) {
  return str.toLowerCase().normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').replace(/[^a-z-]/g, '').trim();
}

function parseNames(raw) {
  if (!raw || raw === 'n/a' || raw.trim() === '') return [];
  return raw.split(',').map(n => n.trim()).filter(Boolean);
}

function buildIndex(byDate) {
  const byName = {};
  for (const [date, names] of Object.entries(byDate)) {
    for (const name of names) {
      const lower = name.toLowerCase();
      if (!byName[lower]) byName[lower] = date;
      const norm = normalize(name);
      if (norm && !byName[norm]) byName[norm] = date;
    }
  }
  return byName;
}

const outDir = path.join('.', 'data');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);

const frBase = {
  "01-01": ["Marie", "Marion", "Manon", "Marianne"],
  "01-07": ["Virginie"],
  "01-08": ["Nathan"],
  "01-26": ["Mélanie", "Stéphanie"],
  "01-30": ["Pauline"],
  "02-04": ["Véronique", "Veronique"],
  "02-14": ["Valentin"],
  "02-24": ["Mathis"],
  "03-05": ["Chloé", "Maëva", "Maeva"],
  "03-20": ["Axel", "Dylan"],
  "04-01": ["Cédric"],
  "04-08": ["Julie", "Julia", "Juliette"],
  "05-04": ["Florian"],
  "05-07": ["Noé", "Noah"],
  "05-23": ["Didier"],
  "05-30": ["Jeanne"],
  "06-06": ["Hugo"],
  "06-07": ["Adrien"],
  "06-10": ["Laura"],
  "06-13": ["Baptiste"],
  "06-20": ["Léo"],
  "06-24": ["Jean-Baptiste", "Yohan", "Johan"],
  "06-25": ["William", "Liam"],
  "07-01": ["Aaron"],
  "07-05": ["Enzo"],
  "07-08": ["Théo"],
  "07-17": ["Charlotte"],
  "07-18": ["Camille"],
  "07-21": ["Victor"],
  "07-23": ["Brigitte"],
  "07-25": ["Jacques"],
  "08-12": ["Aurélie", "Aurelie"],
  "08-18": ["Hélène"],
  "08-20": ["Samuel"],
  "08-22": ["Margaux", "Margot"],
  "08-25": ["Louis", "Louise"],
  "09-17": ["Stéphane"],
  "09-19": ["Morgan"],
  "09-23": ["Nadine"],
  "09-29": ["Michel", "Raphaël", "Gabriel", "Michaël"],
  "10-27": ["Isaac"],
  "11-13": ["Julien"],
  "11-17": ["Élise", "Elise"],
  "11-21": ["Marine"],
  "12-13": ["Josse", "Joss"],
  "12-16": ["Alicia", "Alice"],
  "12-26": ["Zoé", "Steven"],
  "12-27": ["Jean"],
};

const stats = {};

for (const lang of LANGS) {
  const byDate = {};
  for (const entry of data) {
    const key = `${pad(entry.month)}-${pad(entry.day)}`;
    const names = parseNames(entry[lang]);
    if (names.length > 0) byDate[key] = names;
  }

  if (lang === 'fr') {
    for (const [date, names] of Object.entries(frBase)) {
      const existing = byDate[date] || [];
      byDate[date] = [...new Set([...existing, ...names])];
    }
  }

  const byName = buildIndex(byDate);

  fs.writeFileSync(path.join(outDir, `namedays-${lang}-by-date.json`), JSON.stringify(byDate, null, 2));
  fs.writeFileSync(path.join(outDir, `namedays-${lang}-by-name.json`), JSON.stringify(byName, null, 2));

  stats[lang] = { jours: Object.keys(byDate).length, prenoms: Object.keys(byName).length };
}

console.log('\n✅ Conversion terminée !\n');
console.log('Langue | Jours | Prénoms');
console.log('-------|-------|--------');
for (const [lang, s] of Object.entries(stats)) {
  if (s.jours > 0) console.log(`  ${lang.padEnd(4)} |  ${String(s.jours).padStart(3)}  |  ${s.prenoms}`);
}

const frByName = JSON.parse(fs.readFileSync(path.join(outDir, 'namedays-fr-by-name.json'), 'utf8'));

console.log('\n🔍 Vérifications FR :');
const checks = ['julie','chloe','hugo','leo','baptiste','joss','valentin',
  'isaac','aaron','noah','samuel','liam','william','margaux','yohan',
  'morgan','axel','mathis','noe','dylan','aurelie','maeva'];
for (const p of checks) {
  console.log(`  ${p.padEnd(12)} → ${frByName[p] || '❌ absent'}`);
}
console.log('\n📁 Fichiers dans ./data/');