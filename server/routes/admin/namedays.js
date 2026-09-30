// routes/admin/namedays.js
// Calendrier des fêtes : consultation, modification, prénoms sans fête,
// application aux contacts existants, export JSON.
//
// Toute écriture recharge le cache mémoire (reloadNamedays) : la nouvelle date
// est utilisée tout de suite par les créations de cartes et le cron de 9h.
// Les contacts EXISTANTS ne changent qu'avec POST /apply, et jamais ceux dont la
// fête a été choisie à la main (namedaySource = "manual").

const express = require("express");
const router = express.Router();

const Nameday = require("../../models/nameday.model");
const DateModel = require("../../models/date.model");
const User = require("../../models/user.model");
const { audit } = require("../../services/auditLog");
const {
  findNameDay,
  explainNameDay,
  reloadNamedays,
} = require("../../utils/namedayHelper");
const {
  stripName,
  searchCandidates,
} = require("../../utils/namedayNormalize");

const COUNTRY = "fr";

// ── Helpers ────────────────────────────────────────────────────────────────

/** "02-29" OK, "02-30" non, "13-01" non. */
function isValidDate(date) {
  const m = typeof date === "string" && date.match(/^(\d{2})-(\d{2})$/);
  if (!m) return false;
  const d = new Date(2024, +m[1] - 1, +m[2]); // 2024 : bissextile
  return d.getMonth() + 1 === +m[1] && d.getDate() === +m[2];
}

const frDate = (date) => date.split("-").reverse().join("/");

/** Message lisible quand un prénom existe déjà. */
async function conflictMessage(key) {
  const existing = await Nameday.findOne({ country: COUNTRY, key }).lean();
  if (!existing) return null;
  return existing.aliasOf
    ? `« ${existing.name} » existe déjà (variante de ${existing.aliasOf}, ${frDate(existing.date)}).`
    : `« ${existing.name} » existe déjà (${frDate(existing.date)}).`;
}

function trace(req, metadata) {
  return audit(req, { action: "nameday_edit", userId: req.payload._id, metadata });
}

/**
 * Message quand on veut rattacher une variante à un prénom absent du
 * calendrier. Cas typique : « Jean-Marc », fêté le 27/12 uniquement grâce à la
 * règle des prénoms composés (Jean-Marc → Jean), sans ligne à lui.
 */
function notCanonicalMessage(target) {
  const date = findNameDay(target);
  // Le candidat qui a réellement donné la date (Jean-Luc → luc, Gabriel-Henri → gabriel)
  const via = searchCandidates(target).slice(1).find((c) => findNameDay(c) === date);
  if (date && via) {
    return `« ${target.trim()} » n'est pas dans le calendrier : il est fêté le ${frDate(date)} grâce à la règle des prénoms composés (${via}). Rattachez la variante à ce prénom, ou ajoutez d'abord « ${target.trim()} » comme prénom.`;
  }
  return `« ${target.trim()} » n'est pas un prénom principal du calendrier.`;
}

// ── GET / — tout le calendrier, prénoms principaux + variantes ─────────────

router.get("/", async (req, res) => {
  try {
    const rows = await Nameday.find({ country: COUNTRY })
      .populate("updatedBy", "name")
      .sort({ date: 1, name: 1 })
      .lean();

    const aliasesOf = {};
    for (const r of rows) {
      if (r.aliasOf) (aliasesOf[r.aliasOf] ||= []).push({ _id: r._id, name: r.name });
    }

    const entries = rows
      .filter((r) => !r.aliasOf)
      .map((r) => ({
        _id: r._id,
        name: r.name,
        date: r.date,
        aliases: (aliasesOf[r.name] || []).sort((a, b) => a.name.localeCompare(b.name, "fr")),
        updatedAt: r.updatedAt,
        updatedBy: r.updatedBy?.name || null,
      }));

    res.json({ entries, total: rows.length });
  } catch (error) {
    console.error("❌ admin namedays list:", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

/**
 * Prénoms présents dans les répertoires, regroupés par graphie normalisée.
 * @returns {Promise<Array<{ key, name, cards, users, total }>>}
 */
async function directoryNames({ excludeManual }) {
  const manualFilter = excludeManual ? { namedaySource: { $ne: "manual" } } : {};
  const [cards, users] = await Promise.all([
    DateModel.aggregate([
      { $match: { name: { $nin: [null, ""] }, ...manualFilter } },
      { $group: { _id: "$name", count: { $sum: 1 } } },
    ]),
    User.aggregate([
      { $match: { name: { $nin: [null, ""] }, deletedAt: { $exists: false }, ...manualFilter } },
      { $group: { _id: "$name", count: { $sum: 1 } } },
    ]),
  ]);
  const byKey = {};
  for (const [rows, field] of [[cards, "cards"], [users, "users"]]) {
    for (const { _id: rawName, count } of rows) {
      const key = stripName(rawName);
      if (!key) continue;
      byKey[key] ||= { key, name: rawName.trim(), cards: 0, users: 0 };
      byKey[key][field] += count;
    }
  }
  return Object.values(byKey).map((n) => ({ ...n, total: n.cards + n.users }));
}

// ── GET /compounds — prénoms composés des répertoires ──────────────────────
// Ils ne remontent jamais dans « Sans fête » : la règle des composés leur
// donne toujours une date (Jean-Luc → Luc, Paul-Henri → Paul). Cette liste
// sert à vérifier cette date une fois, et à donner une ligne propre aux
// exceptions. `exact` = le composé a déjà sa ligne (déjà validé).

router.get("/compounds", async (req, res) => {
  try {
    const names = await directoryNames({ excludeManual: false });
    const compounds = names
      .filter((n) => n.key.includes("-"))
      .map((n) => {
        const { date, via, exact } = explainNameDay(n.name);
        return { ...n, date, via, exact };
      })
      .sort(
        (a, b) =>
          Number(a.exact) - Number(b.exact) ||
          b.total - a.total ||
          a.name.localeCompare(b.name, "fr"),
      );
    res.json({ compounds });
  } catch (error) {
    console.error("❌ admin namedays compounds:", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// ── GET /missing — prénoms des répertoires qui n'ont pas de fête ───────────

router.get("/missing", async (req, res) => {
  try {
    // Fêtes choisies à la main exclues : l'utilisateur a déjà tranché
    const names = await directoryNames({ excludeManual: true });
    const missing = names
      .filter((n) => !findNameDay(n.name))
      .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, "fr"));
    res.json({ missing });
  } catch (error) {
    console.error("❌ admin namedays missing:", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// ── POST / — ajouter un prénom ou une variante ─────────────────────────────
// body : { name, date }            → prénom principal
//        { name, aliasOf }         → variante (prend la date du principal)

router.post("/", async (req, res) => {
  try {
    const name = (req.body.name || "").trim();
    const aliasOf = (req.body.aliasOf || "").trim() || null;
    const key = stripName(name);
    if (!key) return res.status(400).json({ message: "Prénom invalide." });

    const conflict = await conflictMessage(key);
    if (conflict) return res.status(409).json({ message: conflict });

    let date = req.body.date;
    let canonicalName = null;
    if (aliasOf) {
      const canonical = await Nameday.findOne({
        country: COUNTRY,
        key: stripName(aliasOf),
        aliasOf: null,
      }).lean();
      if (!canonical) {
        return res.status(400).json({ message: notCanonicalMessage(aliasOf) });
      }
      date = canonical.date;
      canonicalName = canonical.name;
    } else if (!isValidDate(date)) {
      return res.status(400).json({ message: "Date invalide (format MM-JJ)." });
    }

    const entry = await Nameday.create({
      country: COUNTRY,
      name,
      key,
      date,
      aliasOf: canonicalName,
      updatedBy: req.payload._id,
    });
    await reloadNamedays(COUNTRY);
    trace(req, { op: "add", name, date, aliasOf: canonicalName });

    res.status(201).json(entry);
  } catch (error) {
    console.error("❌ admin namedays add:", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// ── PATCH /:id — changer la date, le rattachement ou l'orthographe ─────────
// body : { date }     → prénom principal (ses variantes suivent)
//        { aliasOf }  → variante rattachée à un autre prénom principal
//        { name }     → corriger l'orthographe

router.patch("/:id", async (req, res) => {
  try {
    const entry = await Nameday.findOne({ _id: req.params.id, country: COUNTRY });
    if (!entry) return res.status(404).json({ message: "Prénom introuvable." });

    const before = { name: entry.name, date: entry.date, aliasOf: entry.aliasOf };
    // Prénoms dont la fête peut changer : utile pour POST /apply ensuite
    const affected = new Set([entry.name]);

    // Orthographe
    if (req.body.name !== undefined) {
      const name = (req.body.name || "").trim();
      const key = stripName(name);
      if (!key) return res.status(400).json({ message: "Prénom invalide." });
      if (key !== entry.key) {
        const conflict = await conflictMessage(key);
        if (conflict) return res.status(409).json({ message: conflict });
      }
      if (!entry.aliasOf && name !== entry.name) {
        await Nameday.updateMany(
          { country: COUNTRY, aliasOf: entry.name },
          { aliasOf: name },
        );
      }
      entry.name = name;
      entry.key = key;
      affected.add(name);
    }

    // Date d'un prénom principal → ses variantes suivent
    if (req.body.date !== undefined) {
      if (entry.aliasOf) {
        return res.status(400).json({
          message: `« ${entry.name} » est une variante de ${entry.aliasOf} : changez la date de ${entry.aliasOf}, ou détachez la variante.`,
        });
      }
      if (!isValidDate(req.body.date)) {
        return res.status(400).json({ message: "Date invalide (format MM-JJ)." });
      }
      entry.date = req.body.date;
      const aliases = await Nameday.find(
        { country: COUNTRY, aliasOf: entry.name },
        "name",
      ).lean();
      aliases.forEach((a) => affected.add(a.name));
      await Nameday.updateMany(
        { country: COUNTRY, aliasOf: entry.name },
        { date: entry.date, updatedBy: req.payload._id },
      );
    }

    // Rattachement d'une variante
    if (req.body.aliasOf !== undefined) {
      if (!entry.aliasOf) {
        return res.status(400).json({ message: "Seule une variante peut être rattachée à un autre prénom." });
      }
      const canonical = await Nameday.findOne({
        country: COUNTRY,
        key: stripName(req.body.aliasOf),
        aliasOf: null,
      }).lean();
      if (!canonical) {
        return res.status(400).json({ message: notCanonicalMessage(req.body.aliasOf) });
      }
      entry.aliasOf = canonical.name;
      entry.date = canonical.date;
    }

    entry.updatedBy = req.payload._id;
    await entry.save();
    await reloadNamedays(COUNTRY);
    trace(req, {
      op: "edit",
      before,
      after: { name: entry.name, date: entry.date, aliasOf: entry.aliasOf },
    });

    res.json({ entry, affected: [...affected] });
  } catch (error) {
    console.error("❌ admin namedays edit:", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// ── DELETE /:id — retirer un prénom (et ses variantes) ─────────────────────

router.delete("/:id", async (req, res) => {
  try {
    const entry = await Nameday.findOne({ _id: req.params.id, country: COUNTRY }).lean();
    if (!entry) return res.status(404).json({ message: "Prénom introuvable." });

    const affected = [entry.name];
    if (!entry.aliasOf) {
      const aliases = await Nameday.find({ country: COUNTRY, aliasOf: entry.name }, "name").lean();
      affected.push(...aliases.map((a) => a.name));
      await Nameday.deleteMany({ country: COUNTRY, aliasOf: entry.name });
    }
    await Nameday.deleteOne({ _id: entry._id });
    await reloadNamedays(COUNTRY);
    trace(req, { op: "delete", name: entry.name, date: entry.date, aliasOf: entry.aliasOf, removed: affected });

    res.json({ removed: affected, affected });
  } catch (error) {
    console.error("❌ admin namedays delete:", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// ── POST /apply — reporter le calendrier sur les contacts existants ────────
// body : { names: ["Pauline", ...], dryRun: true|false }
// Ne touche QUE les fêtes automatiques. Une fête choisie à la main
// (namedaySource = "manual") n'est jamais modifiée.

router.post("/apply", async (req, res) => {
  try {
    const names = Array.isArray(req.body.names) ? req.body.names : [];
    const keys = new Set(names.map(stripName).filter(Boolean));
    if (!keys.size) return res.status(400).json({ message: "Aucun prénom indiqué." });
    const dryRun = req.body.dryRun !== false;

    const matches = (name) => searchCandidates(name).some((c) => keys.has(c));
    const changes = [];

    const scan = async (Model, label, filter) => {
      const docs = await Model.find(
        { ...filter, name: { $nin: [null, ""] }, namedaySource: { $ne: "manual" } },
        "name nameday",
      ).lean();
      const ops = [];
      for (const d of docs) {
        if (!matches(d.name)) continue;
        const current = d.nameday || null;
        const next = findNameDay(d.name);
        if (current === next) continue;
        changes.push({ type: label, name: d.name.trim(), from: current, to: next });
        ops.push({
          updateOne: {
            filter: { _id: d._id, namedaySource: { $ne: "manual" } },
            update: { $set: { nameday: next, namedaySource: "auto" } },
          },
        });
      }
      if (!dryRun && ops.length) await Model.bulkWrite(ops);
    };

    await scan(DateModel, "carte", {});
    await scan(User, "compte", { deletedAt: { $exists: false } });

    if (!dryRun && changes.length) {
      trace(req, { op: "apply", names: [...keys], count: changes.length });
    }

    res.json({
      dryRun,
      count: changes.length,
      changes: changes.slice(0, 100),
    });
  } catch (error) {
    console.error("❌ admin namedays apply:", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// ── GET /export — le calendrier au format de data/namedays/fr.json ─────────
// Sert à remettre le fichier du repo à jour : il alimente la copie embarquée
// du mobile (mode local, sans réseau) et le premier remplissage d'une base vide.

router.get("/export", async (req, res) => {
  try {
    const rows = await Nameday.find({ country: COUNTRY }).sort({ date: 1, name: 1 }).lean();
    const days = {};
    const aliases = {};
    for (const r of rows) {
      if (r.aliasOf) aliases[r.name] = r.aliasOf;
      else (days[r.date] ||= []).push(r.name);
    }
    const payload = {
      country: COUNTRY.toUpperCase(),
      version: 1,
      note: "Fichier maison. Un prénom = une seule date. Les variantes vont dans aliases (variante → prénom canonique). Régénérer les index avec: node scripts/build-namedays.js",
      exportedAt: new Date().toISOString(),
      days,
      aliases,
    };
    res.setHeader("Content-Disposition", `attachment; filename="${COUNTRY}.json"`);
    res.json(payload);
  } catch (error) {
    console.error("❌ admin namedays export:", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

module.exports = router;
