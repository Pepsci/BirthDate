const express = require("express");
const router = express.Router();
const userModel = require("../models/user.model");
const { isAuthenticated } = require("../middleware/jwt.middleware");
const uploader = require("../config/cloudinary");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

/* GET current user listing */
router.get("/", isAuthenticated, async (req, res, next) => {
  try {
    console.log("Request received for current user ID:", req.payload._id);
    const user = await userModel.findById(req.payload._id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    const userToFront = {
      _id: user._id,
      name: user.name,
      surname: user.surname,
      email: user.email,
      avatar: user.avatar,
      birthDate: user.birthDate,
      receiveBirthdayEmails: user.receiveBirthdayEmails,
    };
    res.status(200).json(userToFront);
  } catch (error) {
    next(error);
  }
});

/* GET user by ID */
router.get("/:id", isAuthenticated, async (req, res, next) => {
  try {
    console.log("Request received for user ID:", req.params.id);
    const user = await userModel.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    const userToFront = {
      _id: user._id,
      name: user.name,
      surname: user.surname,
      email: user.email,
      avatar: user.avatar,
      birthDate: user.birthDate,
      receiveBirthdayEmails: user.receiveBirthdayEmails, // Ajoutez cette ligne
    };
    res.status(200).json(userToFront);
  } catch (error) {
    next(error);
  }
});

/* PATCH user by ID */
router.patch(
  "/:id",
  uploader.single("avatar"),
  isAuthenticated,
  async (req, res, next) => {
    const { currentPassword, newPassword } = req.body;
    const avatar = req.file?.path || undefined;

    try {
      const user = await userModel.findById(req.params.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Vérifie le mot de passe actuel
      if (currentPassword && newPassword) {
        const passwordCorrect = bcrypt.compareSync(
          currentPassword,
          user.password
        );
        if (!passwordCorrect) {
          return res
            .status(400)
            .json({ message: "Current password is incorrect" });
        }

        // Hachage du nouveau mot de passe
        const salt = bcrypt.genSaltSync(10);
        const hashedPassword = bcrypt.hashSync(newPassword, salt);

        user.password = hashedPassword;
      }

      user.username = req.body.username || user.username;
      user.name = req.body.name || user.name;
      user.email = req.body.email || user.email;
      user.birthDate = req.body.birthDate || user.birthDate;
      if (avatar) {
        user.avatar = avatar;
      }

      // Mise à jour de la préférence d'e-mail
      if (req.body.receiveBirthdayEmails !== undefined) {
        user.receiveBirthdayEmails = req.body.receiveBirthdayEmails;
      }

      const updatedUser = await user.save();

      const payload = {
        _id: updatedUser._id,
        name: updatedUser.name,
        surname: updatedUser.surname,
        email: updatedUser.email,
        avatar: updatedUser.avatar,
        birthDate: updatedUser.birthDate,
        receiveBirthdayEmails: updatedUser.receiveBirthdayEmails, // Ajoutez cette ligne
      };

      const authToken = jwt.sign(payload, process.env.TOKEN_SECRET, {
        algorithm: "HS256",
        expiresIn: "6h",
      });

      res.status(200).json({ payload, authToken });
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
