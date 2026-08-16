const express = require("express");
const router = express.Router();
const PushSubscription = require("../models/PushSubscription.model");
const User = require("../models/user.model");
const { isAuthenticated } = require("../middleware/jwt.middleware");

// POST /push/subscribe
router.post("/subscribe", isAuthenticated, async (req, res) => {
  try {
    const { subscription, userAgent } = req.body;

    if (!subscription?.endpoint || !subscription?.keys?.p256dh) {
      return res.status(400).json({ error: "Subscription invalide" });
    }

    // Upsert : met à jour si l'endpoint existe déjà pour cet user
    // Ligne 17 et 18 — remplace req.user.id par req.payload._id
    await PushSubscription.findOneAndUpdate(
      { user: req.payload._id, "subscription.endpoint": subscription.endpoint },
      { user: req.payload._id, subscription, userAgent },
      { upsert: true, new: true },
    );

    res.json({ success: true });
  } catch (err) {
    console.error("[Push] subscribe error:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// DELETE /push/unsubscribe
router.delete("/unsubscribe", isAuthenticated, async (req, res) => {
  try {
    const { endpoint } = req.body;
    await PushSubscription.deleteOne({
      user: req.payload._id,
      "subscription.endpoint": endpoint,
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// GET /push/vapid-public-key  (le frontend en a besoin pour s'abonner)
router.get("/vapid-public-key", (req, res) => {
  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY });
});

// ── Expo Push (app mobile) ────────────────────────────────────────────────────

// POST /push/expo-token — enregistre le token de l'appareil
router.post("/expo-token", isAuthenticated, async (req, res) => {
  try {
    const { token, platform, appVersion } = req.body;
    if (!token || !/^ExponentPushToken\[.+\]$/.test(token)) {
      return res.status(400).json({ error: "Token Expo invalide" });
    }
    // Le token est ré-enregistré à chaque lancement de l'app (registerForPush) —
    // c'est le meilleur signal qu'on ait de "dernière plateforme/version vue"
    // pour un compte mobile, bien plus fréquent que le login (session persistée).
    const $set = { lastSeenAt: new Date() };
    if (["ios", "android"].includes(platform)) $set.lastPlatform = platform;
    if (appVersion) $set.lastAppVersion = String(appVersion).slice(0, 40);

    // ⚠️ On n'active le push QUE lors de l'enregistrement du tout premier
    // appareil. Auparavant `pushEnabled: true` était écrit à chaque lancement,
    // ce qui réactivait silencieusement le push d'un utilisateur qui venait de
    // le couper dans Réglages — son choix ne survivait pas au redémarrage.
    const existing = await User.findById(req.payload._id).select(
      "expoPushTokens",
    );
    if (!(existing?.expoPushTokens || []).length) $set.pushEnabled = true;

    await User.findByIdAndUpdate(req.payload._id, {
      $addToSet:
        platform === "ios"
          ? { expoPushTokens: token, expoPushTokensIos: token }
          : { expoPushTokens: token },
      $set,
    });
    res.json({ success: true });
  } catch (err) {
    console.error("[Push] expo-token error:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// DELETE /push/expo-token — retire le token (déconnexion)
router.delete("/expo-token", isAuthenticated, async (req, res) => {
  try {
    const { token } = req.body;
    await User.findByIdAndUpdate(req.payload._id, {
      $pull: { expoPushTokens: token, expoPushTokensIos: token },
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Erreur serveur" });
  }
});

module.exports = router;
