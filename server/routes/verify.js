const express = require("express");
const crypto = require("crypto");
const router = express.Router();
const UserModel = require("../models/user.model");

router.options("/", (req, res) => {
  res.header("Access-Control-Allow-Methods", "GET,PUT,POST,DELETE,OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.sendStatus(200);
});

// POST /api/verify-email
// Le token reçu est en clair ; la base ne stocke que son hash SHA-256, valable 24 h.
// Transition : les comptes créés avant ce changement ont un token en clair et
// pas de verificationTokenExpires — on les accepte une dernière fois.
router.post("/", async (req, res) => {
  const { token } = req.body;

  if (!token || typeof token !== "string") {
    return res
      .status(400)
      .json({ code: "TOKEN_INVALID", message: "Token de vérification invalide" });
  }

  try {
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    const user = await UserModel.findOne({
      $or: [
        { verificationToken: hashedToken },
        { verificationToken: token, verificationTokenExpires: null },
      ],
    });

    if (!user) {
      return res
        .status(400)
        .json({ code: "TOKEN_INVALID", message: "Token de vérification invalide" });
    }

    if (
      user.verificationTokenExpires &&
      new Date(user.verificationTokenExpires).getTime() < Date.now()
    ) {
      return res.status(400).json({
        code: "TOKEN_EXPIRED",
        message: "Ce lien de vérification a expiré.",
      });
    }

    user.isVerified = true;
    user.verificationToken = undefined;
    user.verificationTokenExpires = undefined;
    await user.save();

    console.log("✅ Email vérifié pour l'utilisateur", user._id.toString());
    return res.send("Adresse email vérifiée avec succès !");
  } catch (error) {
    console.error("❌ Erreur vérification email:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

module.exports = router;
