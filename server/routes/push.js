const express = require("express");
const router = express.Router();
const PushSubscription = require("../models/PushSubscription.model");
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

module.exports = router;
