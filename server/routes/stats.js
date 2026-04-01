const express = require("express");
const User = require("../models/user.model.js");
const Log = require("../models/log.model.js");

const router = express.Router();
const API_KEY = process.env.STATS_API_KEY;

router.get("/", async (req, res) => {
  const key = req.headers["x-api-key"];
  if (key !== API_KEY) return res.status(403).json({ error: "Forbidden" });

  const today = new Date(new Date().setHours(0, 0, 0, 0));
  const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const last7days = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [
    totalUsers,
    newUsersToday,
    loginsToday,
    loginsLast24h,
    signupsLast7days,
    loginsLast7days,
  ] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ createdAt: { $gte: today } }),
    Log.countDocuments({ action: "login", createdAt: { $gte: today } }),
    Log.countDocuments({ action: "login", createdAt: { $gte: last24h } }),
    User.countDocuments({ createdAt: { $gte: last7days } }),
    Log.countDocuments({ action: "login", createdAt: { $gte: last7days } }),
  ]);

  res.json({
    totalUsers,
    newUsersToday,
    loginsToday,
    loginsLast24h,
    signupsLast7days,
    loginsLast7days,
  });
});

module.exports = router;
