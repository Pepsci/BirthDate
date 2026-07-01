const express = require("express");
const router = express.Router();

const coreRouter = require("./core");
const invitationsRouter = require("./invitations");
const votesRouter = require("./votes");
const giftsRouter = require("./gifts");
const poolRouter = require("./pool");
const bankInfoRouter = require("./bankInfo");

router.use("/", coreRouter);
router.use("/", invitationsRouter);
router.use("/", votesRouter);
router.use("/", giftsRouter);
router.use("/", poolRouter);
router.use("/", bankInfoRouter);

module.exports = router;
