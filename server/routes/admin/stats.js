// routes/admin/stats.js
// GET /api/admin/stats → tableau de bord global

const express = require("express");
const router = express.Router();

const User = require("../../models/user.model");
const DateModel = require("../../models/date.model");
const Friend = require("../../models/friend.model");
const Message = require("../../models/message.model");
const Event = require("../../models/event.model");
const EventMessage = require("../../models/eventMessage.model");
const GiftPoolContribution = require("../../models/giftPoolContribution.model");
const Log = require("../../models/log.model");

router.get("/", async (req, res) => {
  try {
    const now = new Date();
    const today = new Date(new Date().setHours(0, 0, 0, 0));
    const last7days = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const last30days = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [
      totalUsers,
      verifiedUsers,
      deletedUsers,
      newUsersToday,
      newUsers7d,
      newUsers30d,
      loginsToday,
      logins7d,
      totalDates,
      totalFriendships,
      totalMessages,
      totalEvents,
      eventsByStatus,
      upcomingEvents,
      totalEventMessages,
      poolAggregate,
      signupsSeries,
      loginsSeries,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ isVerified: true }),
      User.countDocuments({ deletedAt: { $ne: null } }),
      User.countDocuments({ _id: { $gte: objectIdFromDate(today) } }),
      User.countDocuments({ _id: { $gte: objectIdFromDate(last7days) } }),
      User.countDocuments({ _id: { $gte: objectIdFromDate(last30days) } }),
      Log.countDocuments({ action: "login", createdAt: { $gte: today } }),
      Log.countDocuments({ action: "login", createdAt: { $gte: last7days } }),
      DateModel.countDocuments(),
      Friend.countDocuments(),
      Message.countDocuments(),
      Event.countDocuments(),
      Event.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
      Event.countDocuments({
        $or: [{ fixedDate: { $gte: now } }, { selectedDate: { $gte: now } }],
        status: { $nin: ["cancelled", "done"] },
      }),
      EventMessage.countDocuments(),
      GiftPoolContribution.aggregate([
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 },
            total: { $sum: "$amount" },
          },
        },
      ]),
      // Série des inscriptions sur 30 jours (via Log signup)
      Log.aggregate([
        { $match: { action: "signup", createdAt: { $gte: last30days } } },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      // Série des logins sur 30 jours
      Log.aggregate([
        { $match: { action: "login", createdAt: { $gte: last30days } } },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
    ]);

    const pools = { succeeded: { count: 0, total: 0 }, refunded: { count: 0, total: 0 }, pending: { count: 0, total: 0 }, failed: { count: 0, total: 0 } };
    poolAggregate.forEach((p) => {
      pools[p._id] = { count: p.count, total: p.total };
    });

    const activePools = await Event.countDocuments({ "giftPool.active": true });

    res.json({
      users: {
        total: totalUsers,
        verified: verifiedUsers,
        pendingDeletion: deletedUsers,
        newToday: newUsersToday,
        new7d: newUsers7d,
        new30d: newUsers30d,
      },
      activity: {
        loginsToday,
        logins7d,
        totalDates,
        totalFriendships,
        totalMessages,
        totalEventMessages,
      },
      events: {
        total: totalEvents,
        upcoming: upcomingEvents,
        byStatus: eventsByStatus.reduce((acc, e) => ({ ...acc, [e._id]: e.count }), {}),
      },
      pools: { ...pools, activeCount: activePools },
      series: {
        signups: signupsSeries,
        logins: loginsSeries,
      },
    });
  } catch (error) {
    console.error("❌ Admin stats error:", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// Le schéma User n'a pas de timestamps → on approxime createdAt via l'ObjectId
function objectIdFromDate(date) {
  const { Types } = require("mongoose");
  return new Types.ObjectId(
    Math.floor(date.getTime() / 1000).toString(16) + "0000000000000000",
  );
}

module.exports = router;
