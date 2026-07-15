// routes/admin/logs.js
// Consultation des logs d'activité

const express = require("express");
const router = express.Router();

const Log = require("../../models/log.model");

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

    res.json({ logs, total, page, pages: Math.ceil(total / limit) });
  } catch (error) {
    console.error("❌ Admin logs error:", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

module.exports = router;
