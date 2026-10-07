/**
 * namedayHelper.js
 *
 * Lookup des fêtes par prénom.
 *
 * D'où viennent les données :
 *  1. la collection Nameday (source de vérité, modifiable depuis l'admin),
 *     chargée en mémoire au démarrage et rechargée après chaque modification ;
 *  2. à défaut (base injoignable, script lancé sans connexion, tests), les
 *     index JSON générés par scripts/build-namedays.js depuis
 *     data/namedays/<pays>.json.
 *
 * findNameDay() reste SYNCHRONE : il lit toujours le cache mémoire, jamais la
 * base directement. Les routes qui l'appellent n'ont donc pas changé.
 *
 * Règle : un prénom absent du calendrier du pays n'a PAS de fête.
 * Pas de repli sur un autre pays (l'ancien repli US fêtait « Mia » le 29/09).
 */

const path = require("path");
const fs = require("fs");
const mongoose = require("mongoose");
const { stripName, searchCandidates } = require("./namedayNormalize");

const DATA_DIR = path.join(__dirname, "../data");

// cache[pays] = { byName: { clé: "MM-DD" }, byDate: { "MM-DD": [prénoms] }, source }
const cache = {};

// ── Repli JSON ─────────────────────────────────────────────────────────────

function readJson(file) {
  const filePath = path.join(DATA_DIR, file);
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function loadFromJson(country) {
  const byName = readJson(`namedays-${country}-by-name.json`);
  const byDate = readJson(`namedays-${country}-by-date.json`);
  if (!byName) console.warn(`⚠️  Index de fêtes manquant pour « ${country} »`);
  return { byName: byName || {}, byDate: byDate || {}, source: "json" };
}

function getIndex(country) {
  if (!cache[country]) cache[country] = loadFromJson(country);
  return cache[country];
}

// ── Base de données ────────────────────────────────────────────────────────

// Chargé à la demande : les scripts qui n'utilisent que le repli JSON
// (build, tests) n'ont pas besoin du modèle.
const Nameday = () => require("../models/nameday.model");

/** Construit les deux index à partir des lignes de la collection. */
function buildIndex(rows) {
  const byName = {};
  const byDate = {};
  for (const r of rows) {
    byName[r.key] = r.date;
    if (!r.aliasOf) (byDate[r.date] ||= []).push(r.name);
  }
  for (const names of Object.values(byDate)) names.sort((a, b) => a.localeCompare(b, "fr"));
  return { byName, byDate, source: "db" };
}

/**
 * Recharge le cache d'un pays depuis la base.
 * À appeler après toute écriture dans la collection (routes admin).
 * @returns {boolean} true si la base contenait des données
 */
async function reloadNamedays(country = "fr") {
  const rows = await Nameday()
    .find({ country }, "name key date aliasOf")
    .sort({ createdAt: 1 })
    .lean();
  // Base vide : on garde le repli JSON, sauf si c'est l'admin qui vient de
  // tout supprimer (le cache venait déjà de la base) : il doit alors être vide.
  if (!rows.length && cache[country]?.source !== "db") return false;
  cache[country] = buildIndex(rows);
  return rows.length > 0;
}

/**
 * Remplit la collection depuis data/namedays/<pays>.json si elle est vide.
 * Ne touche à rien si des lignes existent déjà : après le premier démarrage,
 * c'est la base qui fait foi, pas le fichier.
 * @returns {number} nombre de lignes insérées
 */
async function seedNamedays(country = "fr") {
  const Model = Nameday();
  if (await Model.exists({ country })) return 0;

  const src = readJson(`namedays/${country}.json`);
  if (!src) return 0;

  const docs = [];
  const dateOf = {};
  for (const [date, names] of Object.entries(src.days)) {
    for (const name of names) {
      docs.push({ country, name, key: stripName(name), date, aliasOf: null });
      dateOf[stripName(name)] = date;
    }
  }
  for (const [alias, canonical] of Object.entries(src.aliases || {})) {
    const date = dateOf[stripName(canonical)];
    if (date) docs.push({ country, name: alias, key: stripName(alias), date, aliasOf: canonical });
  }

  // ordered: false → une clé en double n'arrête pas tout l'import
  await Model.insertMany(docs, { ordered: false }).catch((e) => {
    if (e.code !== 11000) throw e;
  });
  return docs.length;
}

/**
 * Au démarrage du serveur : attend la connexion Mongo, remplit la collection
 * si besoin, puis charge le cache. En cas d'échec, le repli JSON reste actif :
 * les fêtes continuent de fonctionner, seules les modifs admin manquent.
 */
async function initNamedays(country = "fr") {
  try {
    if (mongoose.connection.readyState !== 1) {
      await new Promise((resolve) => mongoose.connection.once("connected", resolve));
    }
    const seeded = await seedNamedays(country);
    if (seeded) console.log(`🌸 Calendrier des fêtes initialisé en base (${seeded} prénoms)`);
    if (await reloadNamedays(country)) {
      console.log(`🌸 Calendrier des fêtes chargé depuis la base (${country})`);
    }
  } catch (e) {
    console.error("❌ Calendrier des fêtes : base indisponible, repli sur le JSON", e.message);
  }
}

// ── Lecture ────────────────────────────────────────────────────────────────

/**
 * Date de fête d'un prénom.
 * @param {string} firstName - "Gabriel-Henri", "  Raphaël ", "Mickaël"…
 * @param {string} country   - code pays du calendrier (défaut : 'fr')
 * @returns {string|null}    - "MM-DD" ou null si le prénom n'est pas fêté
 */
function findNameDay(firstName, country = "fr") {
  const { byName } = getIndex(country);
  for (const candidate of searchCandidates(firstName)) {
    if (byName[candidate]) return byName[candidate];
  }
  return null;
}

/**
 * Comme findNameDay, mais dit aussi D'OÙ vient la date : pour l'admin.
 * @returns {{ date: string|null, via: string|null, exact: boolean }}
 *   exact = le prénom entier a sa propre ligne ; sinon `via` est la clé
 *   utilisée par la règle des prénoms composés (Jean-Luc → "luc").
 */
function explainNameDay(firstName, country = "fr") {
  const { byName } = getIndex(country);
  const candidates = searchCandidates(firstName);
  for (const [i, candidate] of candidates.entries()) {
    if (byName[candidate]) {
      return { date: byName[candidate], via: candidate, exact: i === 0 };
    }
  }
  return { date: null, via: null, exact: false };
}

/** Prénoms principaux fêtés à une date ("MM-DD"). */
function getNamesForDate(date, country = "fr") {
  return getIndex(country).byDate[date] || [];
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

/**
 * Décide de la fête à enregistrer et de sa source, à la création ou à la
 * modification d'une carte ou d'un compte.
 *
 * Le web et le mobile renvoient la fête même quand l'utilisateur n'y a pas
 * touché : on ne peut donc pas se fier à « le champ est présent ». On compare
 * la valeur reçue au calendrier :
 *   - identique au calendrier → "auto"   (suivra les corrections du calendrier)
 *   - différente / vidée      → "manual" (on n'y touchera plus jamais)
 *
 * @param {object}  p
 * @param {string}  p.name      - prénom après modification
 * @param {string|null|undefined} p.incoming - fête reçue (undefined = non envoyée)
 * @param {object}  [p.existing] - document actuel { name, nameday, namedaySource }
 * @returns {{ nameday: string|null, namedaySource: "auto"|"manual" }}
 */
function resolveNameday({ name, incoming, existing }) {
  const auto = findNameDay(name);
  const current = existing ? existing.nameday || null : null;
  const wasManual = existing?.namedaySource === "manual";
  const nameChanged =
    !!existing && (existing.name || "").trim() !== (name || "").trim();

  // Fête non envoyée : on garde l'existant, sauf renommage d'une fête auto
  if (incoming === undefined) {
    if (existing && (wasManual || !nameChanged)) {
      return { nameday: current, namedaySource: wasManual ? "manual" : "auto" };
    }
    return { nameday: auto, namedaySource: "auto" };
  }

  const value = incoming || null;

  // Renommage (Pauline → Paul) : le formulaire renvoie l'ancienne fête telle
  // quelle. Si elle était automatique, elle suit le nouveau prénom.
  if (existing && !wasManual && nameChanged && value === current) {
    return { nameday: auto, namedaySource: "auto" };
  }

  // Même valeur qu'avant sur une fête manuelle : elle reste manuelle
  if (wasManual && value === current) {
    return { nameday: value, namedaySource: "manual" };
  }

  return { nameday: value, namedaySource: value === auto ? "auto" : "manual" };
}

module.exports = {
  initNamedays,
  reloadNamedays,
  seedNamedays,
  resolveNameday,
  findNameDay,
  explainNameDay,
  getNamesForDate,
  isNameDayToday,
};
