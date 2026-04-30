const express = require("express");
const router = express.Router();

const coreRouter = require("./core");
const invitationsRouter = require("./invitations");
const votesRouter = require("./votes");
const giftsRouter = require("./gifts");

router.use("/", coreRouter);
router.use("/", invitationsRouter);
router.use("/", votesRouter);
router.use("/", giftsRouter);

module.exports = router;
