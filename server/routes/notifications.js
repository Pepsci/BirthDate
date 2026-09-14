const express = require("express");
const router = express.Router();
const Notification = require("../models/notification.model");
const { isAuthenticated } = require("../middleware/jwt.middleware");

// GET /api/notifications?page=1&limit=20
router.get("/", isAuthenticated, async (req, res) => {
  try {
    const userId = req.payload._id;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, parseInt(req.query.limit) || 20);
    const skip = (page - 1) * limit;

    const [notifications, unreadCount] = await Promise.all([
      Notification.find({ userId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Notification.countDocuments({ userId, read: false }),
    ]);

    res.json({ notifications, unreadCount, page, limit });
  } catch (err) {
    console.error("❌ GET /notifications:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// PATCH /api/notifications/read-all — avant /:id pour éviter le conflit
router.patch("/read-all", isAuthenticated, async (req, res) => {
  try {
    const userId = req.payload._id;
    await Notification.updateMany({ userId, read: false }, { read: true });
    res.json({ success: true });
  } catch (err) {
    console.error("❌ PATCH /notifications/read-all:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

/*
 * PATCH /api/notifications/read-conversation
 * Body: { kind: "dm" | "event", id }
 *
 * Marque comme lues les notifications qui portent sur une conversation qu'on
 * vient d'ouvrir.
 *
 * ⚠️ Pourquoi c'est nécessaire : un utilisateur lit rarement ses messages
 * depuis le centre de notifications. Il ouvre l'application, va dans le chat,
 * lit — et la pastille reste rouge pour un message déjà lu. Il finit par ne
 * plus la croire, et le compteur ne veut plus rien dire. Une notification
 * décrit un fait ; quand ce fait est consommé ailleurs, elle doit s'éteindre.
 *
 * Le champ visé est verrouillé par `kind` : on ne laisse pas le client choisir
 * quel type et quelle clé filtrer, sinon la route deviendrait un « marque
 * comme lu ce que je veux » piloté depuis l'extérieur.
 */
router.patch("/read-conversation", isAuthenticated, async (req, res) => {
  try {
    const userId = req.payload._id;
    const { kind, id } = req.body;
    if (!id || typeof id !== "string") {
      return res.status(400).json({ message: "Identifiant manquant." });
    }

    let filter;
    if (kind === "dm") {
      filter = { type: "new_message", "data.conversationId": id };
    } else if (kind === "event") {
      filter = { type: "event_chat_message", "data.eventShortId": id };
    } else {
      return res.status(400).json({ message: "Type de conversation inconnu." });
    }

    const result = await Notification.updateMany(
      { userId, read: false, ...filter },
      { read: true },
    );

    res.json({ success: true, updated: result.modifiedCount ?? 0 });
  } catch (err) {
    console.error("❌ PATCH /notifications/read-conversation:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// PATCH /api/notifications/:id/read
router.patch("/:id/read", isAuthenticated, async (req, res) => {
  try {
    const userId = req.payload._id;
    await Notification.findOneAndUpdate(
      { _id: req.params.id, userId },
      { read: true },
    );
    res.json({ success: true });
  } catch (err) {
    console.error("❌ PATCH /notifications/:id/read:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// DELETE /api/notifications/:id — supprimer une notif
router.delete("/:id", isAuthenticated, async (req, res) => {
  try {
    const userId = req.payload._id;
    await Notification.findOneAndDelete({ _id: req.params.id, userId });
    res.json({ success: true });
  } catch (err) {
    console.error("❌ DELETE /notifications/:id:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// DELETE /api/notifications — supprimer toutes les notifs
router.delete("/", isAuthenticated, async (req, res) => {
  try {
    const userId = req.payload._id;
    await Notification.deleteMany({ userId });
    res.json({ success: true });
  } catch (err) {
    console.error("❌ DELETE /notifications:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

module.exports = router;
