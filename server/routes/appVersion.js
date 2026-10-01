// routes/appVersion.js
// GET /api/app-version — dernière version mobile disponible dans les stores.
//
// L'app compare avec sa propre version (CHANGELOG[0].version, embarquée dans
// le bundle) et affiche un bandeau « Nouvelle version disponible » si elle est
// en retard. Pas d'authentification : l'information est publique et l'appel
// doit marcher avant même la connexion.
//
// Source : config/mobileRelease.json, relu à chaque requête — un git pull
// suffit pour annoncer une version, sans redémarrer le serveur.

const express = require("express");
const fs = require("fs/promises");
const path = require("path");

const router = express.Router();
const FILE = path.join(__dirname, "../config/mobileRelease.json");

router.get("/", async (req, res) => {
  try {
    const { android = null, ios = null } = JSON.parse(await fs.readFile(FILE, "utf8"));
    // Petit cache côté client : l'app interroge à chaque retour sur l'accueil
    res.set("Cache-Control", "public, max-age=300");
    res.json({ android, ios });
  } catch (error) {
    console.error("❌ app-version:", error.message);
    // Pas de bandeau plutôt qu'une erreur : cette route n'est jamais bloquante
    res.json({ android: null, ios: null });
  }
});

module.exports = router;
