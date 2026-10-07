// routes/appVersion.js
// GET /api/app-version, bandeaux de l'accueil mobile (public, sans compte) :
//   - android / ios : dernière version disponible en store (+ texte facultatif)
//   - announcement  : annonce en cours, ou null
//
// Contenu édité depuis l'admin (Bandeaux app → routes/admin/appBanners.js),
// stocké dans la collection AppBanner. Voir models/appBanner.model.js.

const express = require("express");
const AppBanner = require("../models/appBanner.model");

const router = express.Router();

/** Annonce encore en cours (date de fin incluse), ou null. */
function activeAnnouncement(a) {
  if (!a || !a.id || !(a.title || a.message)) return null;
  if (a.until) {
    const end = new Date(`${a.until}T23:59:59`);
    if (!Number.isNaN(end.getTime()) && end < new Date()) return null;
  }
  return {
    id: a.id,
    title: a.title || null,
    message: a.message || null,
    url: a.url || null,
    platforms: a.platforms?.length ? a.platforms : ["android", "ios"],
  };
}

const release = (r) =>
  r
    ? { version: r.version || null, url: r.url || null, title: r.title || null, message: r.message || null }
    : null;

router.get("/", async (req, res) => {
  try {
    const doc = await AppBanner.getMobile();
    // Petit cache côté client : l'app interroge à chaque retour sur l'accueil
    res.set("Cache-Control", "public, max-age=120");
    res.json({
      android: release(doc.android),
      ios: release(doc.ios),
      announcement: activeAnnouncement(doc.announcement),
    });
  } catch (error) {
    console.error("❌ app-version:", error.message);
    // Pas de bandeau plutôt qu'une erreur : cette route n'est jamais bloquante
    res.json({ android: null, ios: null, announcement: null });
  }
});

module.exports = router;
