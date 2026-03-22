/**
 * namedayHelper.js
 *
 * Lookup des fêtes par prénom, multi-langue.
 * Priorité : FR → US (fallback) → null
 *
 * Format des fichiers : { "julie": "04-08", "sophie": "05-25", ... }
 */

const path = require('path');
const fs   = require('fs');

// Cache en mémoire : on charge chaque langue une seule fois
const cache = {};

function getIndex(lang) {
  if (!cache[lang]) {
    const filePath = path.join(__dirname, `../data/namedays-${lang}-by-name.json`);
    if (!fs.existsSync(filePath)) {
      console.warn(`⚠️  Fichier namedays manquant pour la langue : ${lang}`);
      cache[lang] = {};
    } else {
      cache[lang] = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }
  }
  return cache[lang];
}

function getDateIndex(lang) {
  const key = `date_${lang}`;
  if (!cache[key]) {
    const filePath = path.join(__dirname, `../data/namedays-${lang}-by-date.json`);
    if (!fs.existsSync(filePath)) {
      cache[key] = {};
    } else {
      cache[key] = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }
  }
  return cache[key];
}

/**
 * Normalise un prénom pour la recherche
 * "Jean-Marie" → ["jean-marie", "jean"]
 * "José" → ["jose", "josé"]
 */
function normalizeFirstName(firstName) {
  if (!firstName) return [];

  const lower = firstName.toLowerCase().trim();

  // Version sans accents
  const norm = lower
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z-]/g, '');

  const candidates = new Set([lower, norm]);

  // Si prénom composé (Jean-Marie), ajouter le premier prénom seul
  if (lower.includes('-')) {
    const first = lower.split('-')[0];
    const firstNorm = norm.split('-')[0];
    candidates.add(first);
    candidates.add(firstNorm);
  }

  return [...candidates].filter(Boolean);
}

/**
 * Trouve la date de fête d'un prénom
 * Priorité : lang (fr par défaut) → us (fallback) → null
 *
 * @param {string} firstName - Le prénom à chercher
 * @param {string} lang      - Code langue (défaut: 'fr')
 * @returns {string|null}    - Date au format "MM-DD" ou null
 */
function findNameDay(firstName, lang = 'fr') {
  if (!firstName) return null;

  const candidates = normalizeFirstName(firstName);

  // 1. Cherche dans la langue demandée (fr par défaut)
  const primaryIndex = getIndex(lang);
  for (const candidate of candidates) {
    if (primaryIndex[candidate]) {
      return primaryIndex[candidate];
    }
  }

  // 2. Fallback sur US si lang !== 'us' et rien trouvé
  if (lang !== 'us') {
    const usIndex = getIndex('us');
    for (const candidate of candidates) {
      if (usIndex[candidate]) {
        return usIndex[candidate];
      }
    }
  }

  return null;
}

/**
 * Récupère tous les prénoms fêtés à une date donnée
 * @param {string} date - Format "MM-DD"
 * @param {string} lang - Code langue (défaut: 'fr')
 * @returns {string[]}  - Liste des prénoms
 */
function getNamesForDate(date, lang = 'fr') {
  const index = getDateIndex(lang);
  return index[date] || [];
}

/**
 * Vérifie si aujourd'hui est la fête d'un prénom
 * @param {string} firstName
 * @param {string} lang
 * @returns {boolean}
 */
function isNameDayToday(firstName, lang = 'fr') {
  const today = new Date();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  const todayKey = `${mm}-${dd}`;

  const nameday = findNameDay(firstName, lang);
  return nameday === todayKey;
}

module.exports = {
  findNameDay,
  getNamesForDate,
  isNameDayToday,
};