// routes/admin/appBanners.js
// Bandeaux de l'accueil mobile : version publiée par plateforme + annonce.
// Lu par l'app via GET /api/app-version (routes/appVersion.js).

const express = require("express");
const crypto = require("crypto");
const router = express.Router();

const AppBanner = require("../../models/appBanner.model");
const { audit } = require("../../services/auditLog");

const clean = (v, max) => {
  const s = String(v ?? "").trim();
  return s ? s.slice(0, max) : null;
};

const VERSION_RE = /^\d+(\.\d+){0,3}$/;
const URL_RE = /^(https?:\/\/|itms-beta:\/\/|market:\/\/|\/)/;

function readRelease(body = {}, label) {
  const version = clean(body.version, 20);
  if (version && !VERSION_RE.test(version)) {
    throw new Error(`${label} : version invalide (ex. 2.3.2).`);
  }
  const url = clean(body.url, 300);
  if (url && !URL_RE.test(url)) throw new Error(`${label} : lien invalide.`);
  return {
    version,
    url,
    title: clean(body.title, 80),
    message: clean(body.message, 240),
  };
}

// GET /api/admin/app-banners
router.get("/", async (req, res) => {
  try {
    const doc = await AppBanner.getMobile();
    await doc.populate("updatedBy", "name");
    res.json(doc);
  } catch (error) {
    console.error("❌ admin app-banners get:", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// PUT /api/admin/app-banners/releases : { android, ios }
router.put("/releases", async (req, res) => {
  try {
    const android = readRelease(req.body.android, "Android");
    const ios = readRelease(req.body.ios, "iOS");
    const doc = await AppBanner.getMobile();
    const before = { android: doc.android?.version, ios: doc.ios?.version };
    doc.android = android;
    doc.ios = ios;
    doc.updatedBy = req.payload._id;
    await doc.save();
    audit(req, {
      action: "app_banner_edit",
      userId: req.payload._id,
      metadata: { op: "releases", before, after: { android: android.version, ios: ios.version } },
    });
    res.json(doc);
  } catch (error) {
    if (error.message?.includes(":")) return res.status(400).json({ message: error.message });
    console.error("❌ admin app-banners releases:", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// PUT /api/admin/app-banners/announcement : publier (nouvel id → visible par tous)
// body : { title, message, url, platforms, until } ; DELETE pour retirer.
router.put("/announcement", async (req, res) => {
  try {
    const title = clean(req.body.title, 80);
    const message = clean(req.body.message, 400);
    if (!title && !message) {
      return res.status(400).json({ message: "Un titre ou un message est requis." });
    }
    const url = clean(req.body.url, 300);
    if (url && !URL_RE.test(url)) {
      return res.status(400).json({ message: "Lien invalide : https://… ou un écran de l'app (/contact)." });
    }
    const until = clean(req.body.until, 10);
    if (until && !/^\d{4}-\d{2}-\d{2}$/.test(until)) {
      return res.status(400).json({ message: "Date de fin invalide." });
    }
    const platforms = (Array.isArray(req.body.platforms) ? req.body.platforms : [])
      .filter((p) => p === "android" || p === "ios");
    if (!platforms.length) {
      return res.status(400).json({ message: "Choisissez au moins une plateforme." });
    }

    const doc = await AppBanner.getMobile();
    // Nouvel id à chaque publication : même ceux qui avaient fermé l'annonce
    // précédente verront celle-ci.
    doc.announcement = {
      id: crypto.randomBytes(6).toString("hex"),
      title,
      message,
      url,
      platforms,
      until,
    };
    doc.updatedBy = req.payload._id;
    await doc.save();
    audit(req, {
      action: "app_banner_edit",
      userId: req.payload._id,
      metadata: { op: "announce", title, until, platforms },
    });
    res.json(doc);
  } catch (error) {
    console.error("❌ admin app-banners announcement:", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

router.delete("/announcement", async (req, res) => {
  try {
    const doc = await AppBanner.getMobile();
    doc.announcement = null;
    doc.updatedBy = req.payload._id;
    await doc.save();
    audit(req, {
      action: "app_banner_edit",
      userId: req.payload._id,
      metadata: { op: "remove_announcement" },
    });
    res.json(doc);
  } catch (error) {
    console.error("❌ admin app-banners remove:", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

module.exports = router;
