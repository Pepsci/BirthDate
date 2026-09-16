/**
 * POST /api/receipts/delivered — accusé « distribué » envoyé par l'appareil à
 * la réception d'une notification push (app fermée, donc sans socket).
 *
 * Route publique : l'authentification est le jeton HMAC embarqué dans la push
 * (voir utils/messageReceipts.js). Réponse toujours 204, qu'il soit valide ou
 * non : l'appelant n'a rien à en apprendre, et l'extension iOS n'en fait rien.
 */
const express = require("express");
const mongoose = require("mongoose");
const rateLimit = require("express-rate-limit");
const { ipKeyGenerator } = require("express-rate-limit");
const {
  markDeliveredFromPush,
  verifyDeliveryToken,
} = require("../utils/messageReceipts");

const router = express.Router();

const receiptLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: ipKeyGenerator,
});

router.post("/delivered", receiptLimiter, async (req, res) => {
  const { messageId, recipientId, receiptToken } = req.body || {};

  try {
    if (
      mongoose.isValidObjectId(messageId) &&
      mongoose.isValidObjectId(recipientId) &&
      verifyDeliveryToken(String(messageId), String(recipientId), receiptToken)
    ) {
      await markDeliveredFromPush(req.app.get("io"), messageId, recipientId);
    }
  } catch (error) {
    console.error("❌ Error delivery receipt:", error);
  }
  return res.sendStatus(204);
});

module.exports = router;
