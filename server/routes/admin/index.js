// routes/admin/index.js
// Toutes les routes /api/admin/* sont protégées par JWT + rôle admin.

const express = require("express");
const router = express.Router();

const { isAuthenticated } = require("../../middleware/jwt.middleware");
const { isAdmin } = require("../../middleware/isAdmin");

router.use(isAuthenticated, isAdmin);

router.use("/stats", require("./stats"));
router.use("/users", require("./users"));
router.use("/pools", require("./pools"));
router.use("/events", require("./events"));
router.use("/logs", require("./logs"));

module.exports = router;
