const express = require("express");
const User = require("../models/User.js");

const router = express.Router();

const API_KEY = process.env.STATS_API_KEY;

router.get("/", async (req, res) => {
  const key = req.headers["x-api-key"];
  if (key !== API_KEY) return res.status(403).json({ error: "Forbidden" });

  const totalUsers = await User.countDocuments();
  const newUsersToday = await User.countDocuments({
    createdAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) },
  });

  res.json({ totalUsers, newUsersToday });
});

module.exports = router;
