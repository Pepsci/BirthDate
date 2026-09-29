/**
 * namedayHelper.js
 *
 * Lookup des fêtes par prénom.
 *
 * Source : data/namedays/<pays>.json (fichier maison), compilé en index par
 * scripts/build-namedays.js → data/namedays-<pays>-by-name.json / -by-date.json.
 *
 * Règle : un prénom absent du calendrier du pays n'a PAS de fête.
 * Plus de repli sur un autre pays (l'ancien repli US donnait par exemple
 * « Mia » fêtée le 29/09 à des utilisateurs français).
 */

const path = require("path");
const fs = require("fs");
const { searchCandidates } = require("./namedayNormalize");

// Cache en mémoire : chaque index n'est lu qu'une fois
const cache = {};

function loadIndex(country, kind) {
  const key = `${country}_${kind}`;
  if (!cache[key]) {
    const filePath = path.join(
      __dirname,
      `../data/namedays-${country}-by-${kind}.json`,
    );
    if (!fs.existsSync(filePath)) {
      console.warn(`⚠️  Index de fêtes manquant : ${path.basename(filePath)}`);
      cache[key] = {};
    } else {
      cache[key] = JSON.parse(fs.readFileSync(filePath, "utf8"));
    }
  }
  return cache[key];
}

/**
 * Date de fête d'un prénom.
 * @param {string} firstName - "Gabriel-Henri", "  Raphaël ", "Mickaël"…
 * @param {string} country   - code pays du calendrier (défaut : 'fr')
 * @returns {string|null}    - "MM-DD" ou null si le prénom n'est pas fêté
 */
function findNameDay(firstName, country = "fr") {
  const index = loadIndex(country, "name");
  for (const candidate of searchCandidates(firstName)) {
    if (index[candidate]) return index[candidate];
  }
  return null;
}

/**
 * Prénoms fêtés à une date.
 * @param {string} date    - "MM-DD"
 * @param {string} country - défaut : 'fr'
 * @returns {string[]}
 */
function getNamesForDate(date, country = "fr") {
  return loadIndex(country, "date")[date] || [];
}

/** La fête de ce prénom tombe-t-elle aujourd'hui (heure de Paris) ? */
function isNameDayToday(firstName, country = "fr") {
  const today = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Europe/Paris" }),
  );
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  return findNameDay(firstName, country) === `${mm}-${dd}`;
}

module.exports = {
  findNameDay,
  getNamesForDate,
  isNameDayToday,
};
