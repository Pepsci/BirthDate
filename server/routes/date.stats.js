const express = require("express");
const router = express.Router();
const dateModel = require("./../models/date.model");
const { isAuthenticated } = require("../middleware/jwt.middleware");
const userModel = require("../models/user.model");

// ========================================
// GET /stats - Stats publiques (landing page)
// 🌍 PUBLIC : aucune donnée personnelle
// ========================================
router.get("/stats", async (req, res) => {
  try {
    const now = new Date();
    const todayMonth = now.getMonth() + 1;
    const todayDay = now.getDate();

    const allDates = await dateModel.find({}, { date: 1 });

    const currentYear = now.getFullYear();
    let today = 0;
    let thisMonth = 0;
    let thisYear = 0;

    allDates.forEach((entry) => {
      const d = new Date(entry.date);
      const month = d.getMonth() + 1;
      const day = d.getDate();

      if (month === todayMonth) thisMonth++;
      if (month === todayMonth && day === todayDay) today++;

      const birthdayThisYear = new Date(currentYear, month - 1, day);
      if (birthdayThisYear >= new Date(currentYear, 0, 1)) thisYear++;
    });

    const totalUsers = await userModel.countDocuments({
      isVerified: true,
      deletedAt: null,
    });

    res
      .status(200)
      .json({ today, thisMonth, thisYear, total: allDates.length, totalUsers });
  } catch (error) {
    console.error("Error fetching public stats:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// ========================================
// GET /stats/me - Stats personnelles
// 🔒 SÉCURISÉ
// ========================================
router.get("/stats/me", isAuthenticated, async (req, res) => {
  try {
    const userId = req.payload._id;
    const now = new Date();
    const todayMonth = now.getMonth() + 1;
    const todayDay = now.getDate();
    const currentYear = now.getFullYear();

    const allDates = await dateModel.find({ owner: userId }, { date: 1 });

    let today = 0;
    let thisMonth = 0;
    let thisYear = 0;

    allDates.forEach((entry) => {
      const d = new Date(entry.date);
      const month = d.getMonth() + 1;
      const day = d.getDate();

      if (month === todayMonth) thisMonth++;
      if (month === todayMonth && day === todayDay) today++;

      const birthdayThisYear = new Date(currentYear, month - 1, day);
      if (birthdayThisYear >= new Date(currentYear, 0, 1)) thisYear++;
    });

    const totalUsers = await userModel.countDocuments({
      isVerified: true,
      deletedAt: null,
    });

    res
      .status(200)
      .json({ today, thisMonth, thisYear, total: allDates.length, totalUsers });
  } catch (error) {
    console.error("Error fetching personal stats:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

module.exports = router;
