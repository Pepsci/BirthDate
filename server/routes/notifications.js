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
