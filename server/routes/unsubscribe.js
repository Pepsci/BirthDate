const express = require("express");
const router = express.Router();
const userModel = require("../models/user.model");

router.get("/unsubscribe", async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) {
      return res.status(400).send("User ID manquant");
    }
    const user = await userModel.findById(userId);
    if (!user) {
      return res.status(404).send("Utilisateur non trouvé");
    }

    user.receiveBirthdayEmails = false;
    await user.save();

    res.send("Vous avez été désabonné des notifications par e-mail.");
  } catch (error) {
    res.status(500).send("Erreur du serveur interne");
  }
});

module.exports = router;
