// ============================================================
// server/routes/chatMutes.js
// Mise en silencieux d'une conversation — privée ou discussion d'événement.
//
// Ne coupe que le PUSH : la notification in-app est toujours créée et le
// badge de non-lus continue de monter. Voir models/chatMute.model.js.
// ============================================================

const router = require("express").Router();
const { isAuthenticated } = require("../middleware/jwt.middleware");
const ChatMute = require("../models/chatMute.model");

/** Durées proposées. `forever` n'a pas d'échéance, d'où `null`. */
const DURATIONS = {
  "1h": 60 * 60 * 1000,
  "8h": 8 * 60 * 60 * 1000,
  "1w": 7 * 24 * 60 * 60 * 1000,
  forever: null,
};

const KINDS = new Set(["dm", "event"]);

/*
 * GET /api/mutes -> mes silencieux encore actifs
 *
 * Les clients s'en servent pour dessiner la cloche barrée et afficher
 * l'échéance. Le filtre sur `until` double l'index TTL, qui ne balaie qu'une
 * fois par minute : sans lui, une cloche resterait barrée après l'expiration.
 */
router.get("/", isAuthenticated, async (req, res) => {
  try {
    const now = new Date();
    const mutes = await ChatMute.find({
      user: req.payload._id,
      $or: [{ until: null }, { until: { $gt: now } }],
    }).select("kind targetId until");
    res.status(200).json(mutes);
  } catch (error) {
    console.error("❌ Error listing mutes:", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

/*
 * PUT /api/mutes -> poser (ou remplacer) un silencieux
 * body { kind: "dm" | "event", targetId, duration: "1h" | "8h" | "1w" | "forever" }
 */
router.put("/", isAuthenticated, async (req, res) => {
  try {
    const { kind, targetId, duration } = req.body || {};
    if (!KINDS.has(kind) || !targetId)
      return res.status(400).json({ message: "Conversation invalide" });
    if (!(duration in DURATIONS))
      return res.status(400).json({ message: "Durée invalide" });

    const ms = DURATIONS[duration];
    const until = ms === null ? null : new Date(Date.now() + ms);

    // upsert : reposer un silencieux remplace le précédent plutôt que d'en
    // empiler un second, que rien ne viendrait jamais retirer.
    const mute = await ChatMute.findOneAndUpdate(
      { user: req.payload._id, kind, targetId: String(targetId) },
      { $set: { until } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    ).select("kind targetId until");

    res.status(200).json(mute);
  } catch (error) {
    console.error("❌ Error muting conversation:", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

/*
 * DELETE /api/mutes/:kind/:targetId -> réactiver les notifications
 */
router.delete("/:kind/:targetId", isAuthenticated, async (req, res) => {
  try {
    const { kind, targetId } = req.params;
    if (!KINDS.has(kind))
      return res.status(400).json({ message: "Conversation invalide" });

    await ChatMute.deleteOne({
      user: req.payload._id,
      kind,
      targetId: String(targetId),
    });
    res.status(200).json({ ok: true });
  } catch (error) {
    console.error("❌ Error unmuting conversation:", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

module.exports = router;
