const express = require("express");
const router = express.Router();
const userModel = require("../models/user.model");
const Friend = require("../models/friend.model"); // 👈 AJOUTÉ
const DateModel = require("../models/date.model"); // 👈 AJOUTÉ
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
      receiveBirthdayEmails: user.receiveBirthdayEmails,
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

      // 👇 AJOUTÉ : Sauvegarder les anciennes valeurs pour détecter les changements
      const oldName = user.name;
      const oldSurname = user.surname;
      const oldBirthDate = user.birthDate;

      // Vérifie le mot de passe actuel
      if (currentPassword && newPassword) {
        const passwordCorrect = bcrypt.compareSync(
          currentPassword,
          user.password,
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
      user.surname =
        req.body.surname !== undefined ? req.body.surname : user.surname; // 👈 MODIFIÉ pour gérer surname vide
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

      // 👇 AJOUTÉ : Synchroniser avec les amis si nom/prénom/date ont changé
      const nameChanged = oldName !== updatedUser.name;
      const surnameChanged = oldSurname !== updatedUser.surname;
      const birthDateChanged =
        oldBirthDate?.toString() !== updatedUser.birthDate?.toString();

      if (nameChanged || surnameChanged || birthDateChanged) {
        console.log(`🔄 Synchronisation nécessaire pour ${updatedUser.name}`);

        try {
          // Trouver toutes les amitiés acceptées
          const friendships = await Friend.find({
            $or: [
              { user: updatedUser._id, status: "accepted" },
              { friend: updatedUser._id, status: "accepted" },
            ],
          });

          console.log(`👥 ${friendships.length} amis trouvés`);

          let syncCount = 0;
          for (const friendship of friendships) {
            // Déterminer qui est l'ami (celui qui possède la date à mettre à jour)
            const friendId =
              friendship.user.toString() === updatedUser._id.toString()
                ? friendship.friend
                : friendship.user;

            // Préparer les données de mise à jour
            const updateData = {};
            if (nameChanged) updateData.name = updatedUser.name;
            if (surnameChanged) updateData.surname = updatedUser.surname || "";
            if (birthDateChanged) updateData.date = updatedUser.birthDate;

            // Mettre à jour la date liée chez cet ami
            const result = await DateModel.findOneAndUpdate(
              {
                owner: friendId,
                linkedUser: updatedUser._id,
              },
              updateData,
              { new: true },
            );

            if (result) {
              syncCount++;
              console.log(`✅ Synchronisé chez l'ami ${friendId}`);
            } else {
              console.log(`⚠️  Aucune date trouvée chez l'ami ${friendId}`);
            }
          }

          console.log(
            `✅ ${syncCount}/${friendships.length} dates synchronisées`,
          );
        } catch (syncError) {
          console.error("❌ Erreur lors de la synchronisation:", syncError);
          // Ne pas faire échouer la requête si la sync échoue
        }
      }

      const payload = {
        _id: updatedUser._id,
        name: updatedUser.name,
        surname: updatedUser.surname,
        email: updatedUser.email,
        avatar: updatedUser.avatar,
        birthDate: updatedUser.birthDate,
        receiveBirthdayEmails: updatedUser.receiveBirthdayEmails,
      };

      const authToken = jwt.sign(payload, process.env.TOKEN_SECRET, {
        algorithm: "HS256",
        expiresIn: "6h",
      });

      res.status(200).json({ payload, authToken });
    } catch (error) {
      next(error);
    }
  },
);

/* DELETE user account */
router.delete("/:id", isAuthenticated, async (req, res, next) => {
  try {
    // Vérifie que l'utilisateur supprime bien son propre compte
    if (req.payload._id.toString() !== req.params.id) {
      return res.status(403).json({
        message: "Vous ne pouvez supprimer que votre propre compte",
      });
    }

    const user = await userModel.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: "Utilisateur non trouvé" });
    }

    // Suppression de l'utilisateur
    await userModel.findByIdAndDelete(req.params.id);

    res.status(200).json({
      message: "Compte supprimé avec succès",
    });
  } catch (error) {
    console.error("Erreur lors de la suppression:", error);
    next(error);
  }
});

module.exports = router;
