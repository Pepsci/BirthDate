const express = require("express");
const router = express.Router();
const UserModel = require("../models/user.model");

router.post("/", async (req, res) => {
  const { token } = req.body; // Utilise req.body pour récupérer le token
  console.log("Token de vérification reçu :", token); // Log du token de vérification
  const user = await UserModel.findOne({ verificationToken: token });

  if (!user) {
    console.log("Token de vérification invalide"); // Log si le token est invalide
    return res.status(400).send("Token de vérification invalide");
  }

  user.isVerified = true;
  user.verificationToken = undefined;
  await user.save();

  console.log(
    "Adresse email vérifiée avec succès pour l'utilisateur :",
    user.email
  ); // Log si la vérification est réussie
  res.send("Adresse email vérifiée avec succès !");
});

module.exports = router;
