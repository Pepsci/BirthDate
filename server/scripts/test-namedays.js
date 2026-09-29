/**
 * test-namedays.js — node scripts/test-namedays.js
 *
 * Vérifie le calendrier maison et le matching des prénoms.
 * Les cas viennent de vrais bugs (notifs du 29/09/2026 : Mia notifiée à tort,
 * espace en trop dans « Raphaël  ! »).
 */

const assert = require("assert/strict");
const fs = require("fs");
const path = require("path");
const {
  findNameDay,
  getNamesForDate,
  resolveNameday,
} = require("../utils/namedayHelper");

let passed = 0;
const failures = [];
function test(label, fn) {
  try { fn(); passed++; }
  catch (e) { failures.push(`${label}\n     ${e.message.split("\n")[0]}`); }
}

// ── Cas pièges ──
const cases = [
  ["Michel", "09-29"],
  ["Gabriel", "09-29"],
  ["Raphaël", "09-29"],
  ["Raphael", "09-29"],          // sans accent
  ["  Raphaël ", "09-29"],       // espaces autour
  ["RAPHAËL", "09-29"],          // majuscules
  ["Mickaël", "09-29"],          // alias
  ["Gabriel-Henri", "09-29"],    // composé → premier prénom
  ["Gabriel - Henri", "09-29"],  // composé mal espacé
  ["Jean-Baptiste", "06-24"],    // composé présent en entier
  ["Marie-Ange", "08-15"],
  ["Mia", "08-15"],              // forme de Marie (le repli US donnait 09-29)
  ["Jade", "06-29"],             // prénom « pierre » → saint Pierre
  ["Lina", "09-23"],             // saint Lin
  ["Micheline", "09-29"],
  ["Michelangelo", null],        // pas de correspondance partielle
  ["Mi", null],
  ["", null],
  [null, null],
  ["Joss", "12-13"],
];
for (const [name, expected] of cases) {
  test(`findNameDay(${JSON.stringify(name)}) = ${expected}`, () =>
    assert.equal(findNameDay(name), expected));
}

test("29/09 : Michel, Gabriel, Raphaël", () =>
  assert.deepEqual(getNamesForDate("09-29"), ["Michel", "Gabriel", "Raphaël"]));

// ── Fête choisie à la main : jamais écrasée ──
const auto = (name, nameday) => ({ name, nameday, namedaySource: "auto" });
const manual = (name, nameday) => ({ name, nameday, namedaySource: "manual" });
const resolveCases = [
  ["création, rien envoyé", { name: "Pauline" }, ["01-11", "auto"]],
  ["création, formulaire pré-rempli", { name: "Pauline", incoming: "01-11" }, ["01-11", "auto"]],
  ["création, autre date choisie", { name: "Pauline", incoming: "01-26" }, ["01-26", "manual"]],
  ["édition sans toucher (auto)", { name: "Pauline", incoming: "01-11", existing: auto("Pauline", "01-11") }, ["01-11", "auto"]],
  ["édition sans toucher (manuelle)", { name: "Pauline", incoming: "01-26", existing: manual("Pauline", "01-26") }, ["01-26", "manual"]],
  ["fête non envoyée (manuelle)", { name: "Pauline", existing: manual("Pauline", "01-26") }, ["01-26", "manual"]],
  ["renommage, fête auto suit", { name: "Paul", incoming: "01-11", existing: auto("Pauline", "01-11") }, ["06-29", "auto"]],
  ["renommage, fête manuelle reste", { name: "Paul", incoming: "01-26", existing: manual("Pauline", "01-26") }, ["01-26", "manual"]],
  ["fête vidée volontairement", { name: "Pauline", incoming: null, existing: auto("Pauline", "01-11") }, [null, "manual"]],
  ["retour à la date du calendrier", { name: "Pauline", incoming: "01-11", existing: manual("Pauline", "01-26") }, ["01-11", "auto"]],
];
for (const [label, input, [nameday, namedaySource]] of resolveCases) {
  test(`resolveNameday : ${label}`, () =>
    assert.deepEqual(resolveNameday(input), { nameday, namedaySource }));
}

// ── Intégrité de l'index généré ──
const byName = require("../data/namedays-fr-by-name.json");
const byDate = require("../data/namedays-fr-by-date.json");

test("aucune fête parasite (fériés, abréviations)", () => {
  const junk = Object.values(byDate).flat().filter((n) =>
    /[.\d]/.test(n) ||                                   // "Th. d'Aquin", "Rameaux +1h"
    /^[A-ZÉ]{3,}$/.test(n) ||                             // "PRINTEMPS", "HIVER"
    /pâques|pentecôte|ascension|toussaint|assomption|jour de l/i.test(n));
  assert.deepEqual(junk, []);
});

test("chaque prénom du calendrier se retrouve à sa date", () => {
  for (const [date, names] of Object.entries(byDate)) {
    for (const n of names) assert.equal(findNameDay(n), date, `${n} devrait être au ${date}`);
  }
});

test("toutes les clés pointent vers une date MM-DD", () => {
  for (const [k, v] of Object.entries(byName)) assert.match(v, /^\d{2}-\d{2}$/, k);
});

test("copie mobile identique à l'index serveur", () => {
  const mobile = path.join(__dirname, "../../mobile/src/data/namedays-fr-by-name.json");
  if (!fs.existsSync(mobile)) return;
  assert.deepEqual(JSON.parse(fs.readFileSync(mobile, "utf8")), byName,
    "relancer node scripts/build-namedays.js");
});

// ── Résultat ──
if (failures.length) {
  console.error(`❌ ${failures.length} échec(s), ${passed} OK :`);
  failures.forEach((f) => console.error("  - " + f));
  process.exit(1);
}
console.log(`✅ ${passed} tests OK`);
