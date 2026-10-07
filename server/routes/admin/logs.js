// routes/admin/logs.js
// Consultation des logs d'activité

const express = require("express");
const router = express.Router();
const geoip = require("geoip-country");

const Log = require("../../models/log.model");
const User = require("../../models/user.model");
const {
  platformFromUserAgent,
  browserFromUserAgent,
} = require("../../utils/signupSource");

// Nom de pays en français ("États-Unis") : Intl.DisplayNames est natif à
// Node, donc pas de dépendance supplémentaire pour ça. geoip-country ne
// renvoie qu'un code ISO à 2 lettres ("US").
const countryNames = new Intl.DisplayNames(["fr"], { type: "region" });

// Emoji drapeau à partir d'un code pays ISO : trick Unicode standard
// (indicateurs régionaux), aucune lib nécessaire.
function flagEmoji(iso) {
  if (!iso || iso.length !== 2) return "";
  return String.fromCodePoint(
    ...[...iso.toUpperCase()].map((c) => 127397 + c.charCodeAt(0)),
  );
}

// "system" (webhook/cron), IP locale (127.0.0.1, ::1) ou IP non résolue par
// la base geoip-country → pas de pays, on ne renvoie rien plutôt qu'un faux
// résultat.
function countryFromIp(ip) {
  try {
    const geo = geoip.lookup(ip);
    if (!geo?.country) return null;
    return { code: geo.country, flag: flagEmoji(geo.country), name: countryNames.of(geo.country) };
  } catch (_) {
    return null;
  }
}

// Provenance d'une inscription, prête à afficher.
// `metadata` n'existe que sur les inscriptions récentes (utils/signupSource.js) ;
// pour les anciennes, la plateforme est déduite du User-Agent, qui a toujours
// été enregistré : c'est ce qui rend la colonne utile rétroactivement.
function signupOrigin(log, inviterNames) {
  const meta = log.metadata || {};
  const invitedBy = (meta.invitedBy || [])
    .map((id) => inviterNames.get(String(id)))
    .filter(Boolean);
  return {
    platform: meta.platform || platformFromUserAgent(log.userAgent),
    appVersion: meta.appVersion || null,
    browser: browserFromUserAgent(log.userAgent),
    referrer: meta.referrer || null,
    landingPath: meta.landingPath || null,
    utm: meta.utm || null,
    invitedBy,
  };
}

/*
 * GET /api/admin/logs?action=&userId=&page=&limit=
 */
router.get("/", async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(200, parseInt(req.query.limit) || 50);
    const { action, userId } = req.query;

    const query = {};
    if (action) query.action = action;
    if (userId) query.userId = userId;

    const [logs, total] = await Promise.all([
      Log.find(query)
        .populate("userId", "name surname email")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Log.countDocuments(query),
    ]);

    // Noms des parrains, en une seule requête pour toute la page.
    const inviterIds = logs.flatMap((log) =>
      log.action === "signup" ? log.metadata?.invitedBy || [] : [],
    );
    const inviters = inviterIds.length
      ? await User.find({ _id: { $in: inviterIds } }).select("name surname")
      : [];
    const inviterNames = new Map(
      inviters.map((u) => [String(u._id), `${u.name} ${u.surname || ""}`.trim()]),
    );

    const logsWithCountry = logs.map((log) => ({
      ...log.toObject(),
      country: countryFromIp(log.ipAddress),
      ...(log.action === "signup"
        ? { origin: signupOrigin(log, inviterNames) }
        : {}),
    }));

    res.json({ logs: logsWithCountry, total, page, pages: Math.ceil(total / limit) });
  } catch (error) {
    console.error("❌ Admin logs error:", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

module.exports = router;
