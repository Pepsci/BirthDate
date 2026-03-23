const express = require("express");
const router = express.Router();
const userModel = require("../models/user.model");
const Friend = require("../models/friend.model");
const DateModel = require("../models/date.model");
const { isAuthenticated } = require("../middleware/jwt.middleware");
const { logAction } = require("../middleware/logger.middleware");
const uploader = require("../config/cloudinary");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const { findNameDay } = require("../utils/namedayHelper");

// ─── Helper : champs utilisateur à envoyer au front ──────────────────────────
function formatUser(user) {
  return {
    _id: user._id,
    name: user.name,
    surname: user.surname,
    email: user.email,
    avatar: user.avatar,
    birthDate: user.birthDate,
    nameday: user.nameday,
    // Onboarding
    onboardingDone: user.onboardingDone,
    // Emails anniversaires
    receiveBirthdayEmails: user.receiveBirthdayEmails,
    receiveFriendRequestEmails: user.receiveFriendRequestEmails,
    receiveOwnBirthdayEmail: user.receiveOwnBirthdayEmail,
    monthlyRecap: user.monthlyRecap,
    // Emails chat
    receiveChatEmails: user.receiveChatEmails,
    chatEmailFrequency: user.chatEmailFrequency,
    chatEmailDisabledFriends: user.chatEmailDisabledFriends,
    // Push
    pushEnabled: user.pushEnabled,
    pushEvents: user.pushEvents,
    pushBirthdayTimings: user.pushBirthdayTimings,
    // E2E
    publicKey: user.publicKey,
    encryptedPrivateKey: user.encryptedPrivateKey,
    e2eMode: user.e2eMode,
  };
}

/* GET current user listing */
router.get("/", isAuthenticated, async (req, res, next) => {
  try {
    console.log("Request received for current user ID:", req.payload._id);
    const user = await userModel.findById(req.payload._id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.status(200).json(formatUser(user));
  } catch (error) {
    next(error);
  }
});

/* GET /users/me - Alias pour l'utilisateur connecté */
router.get("/me", isAuthenticated, async (req, res, next) => {
  try {
    console.log("GET /users/me - User ID:", req.payload._id);
    const user = await userModel.findById(req.payload._id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.status(200).json(formatUser(user));
  } catch (error) {
    next(error);
  }
});

/* PATCH /users/me - Modifier l'utilisateur connecté */
router.patch(
  "/me",
  uploader.single("avatar"),
  isAuthenticated,
  logAction("account_update"),
  async (req, res, next) => {
    const { currentPassword, newPassword } = req.body;
    const avatar = req.file?.path || undefined;

    try {
      console.log("PATCH /users/me - User ID:", req.payload._id);

      const user = await userModel.findById(req.payload._id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

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
        const salt = bcrypt.genSaltSync(10);
        user.password = bcrypt.hashSync(newPassword, salt);

        // ── Re-chiffrement E2E : le front renvoie encryptedPrivateKey re-chiffrée
        if (req.body.encryptedPrivateKey) {
          user.encryptedPrivateKey = req.body.encryptedPrivateKey;
        }
      }

      user.username = req.body.username || user.username;
      user.name = req.body.name || user.name;
      user.surname =
        req.body.surname !== undefined ? req.body.surname : user.surname;
      user.email = req.body.email || user.email;
      user.birthDate = req.body.birthDate || user.birthDate;

      // Nameday
      if (req.body.nameday !== undefined) {
        user.nameday = req.body.nameday || null;
      }

      if (avatar) user.avatar = avatar;

      // ── Onboarding ──────────────────────────────────────────────────────────
      if (req.body.onboardingDone !== undefined) {
        user.onboardingDone = req.body.onboardingDone;
      }

      // ── Préférences emails anniversaires ────────────────────────────────────
      if (req.body.receiveBirthdayEmails !== undefined) {
        user.receiveBirthdayEmails = req.body.receiveBirthdayEmails;
      }
      if (req.body.receiveFriendRequestEmails !== undefined) {
        user.receiveFriendRequestEmails = req.body.receiveFriendRequestEmails;
      }
      if (req.body.receiveOwnBirthdayEmail !== undefined) {
        user.receiveOwnBirthdayEmail = req.body.receiveOwnBirthdayEmail;
      }

      // ── Préférences emails chat ──────────────────────────────────────────────
      if (req.body.receiveChatEmails !== undefined) {
        user.receiveChatEmails = req.body.receiveChatEmails;
      }
      if (req.body.chatEmailFrequency !== undefined) {
        user.chatEmailFrequency = req.body.chatEmailFrequency;
      }

      // ── Préférences push ─────────────────────────────────────────────────────
      if (req.body.pushEnabled !== undefined) {
        user.pushEnabled = req.body.pushEnabled;
      }
      if (req.body.pushEvents !== undefined) {
        user.pushEvents = req.body.pushEvents;
      }
      if (req.body.pushBirthdayTimings !== undefined) {
        user.pushBirthdayTimings = req.body.pushBirthdayTimings;
      }

      const updatedUser = await user.save();

      // Synchroniser avec les amis si nom/prénom/date ont changé
      const nameChanged = oldName !== updatedUser.name;
      const surnameChanged = oldSurname !== updatedUser.surname;
      const birthDateChanged =
        oldBirthDate?.toString() !== updatedUser.birthDate?.toString();

      if (nameChanged || surnameChanged || birthDateChanged) {
        console.log(`🔄 Synchronisation nécessaire pour ${updatedUser.name}`);
        try {
          const friendships = await Friend.find({
            $or: [
              { user: updatedUser._id, status: "accepted" },
              { friend: updatedUser._id, status: "accepted" },
            ],
          });
          console.log(`👥 ${friendships.length} amis trouvés`);
          let syncCount = 0;
          for (const friendship of friendships) {
            const friendId =
              friendship.user.toString() === updatedUser._id.toString()
                ? friendship.friend
                : friendship.user;
            const updateData = {};
            if (nameChanged) updateData.name = updatedUser.name;
            if (surnameChanged) updateData.surname = updatedUser.surname || "";
            if (birthDateChanged) updateData.date = updatedUser.birthDate;
            const result = await DateModel.findOneAndUpdate(
              { owner: friendId, linkedUser: updatedUser._id },
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
        }
      }

      const payload = formatUser(updatedUser);
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

/* PATCH /users/me/nameday - Modifier sa fête */
router.patch("/me/nameday", isAuthenticated, async (req, res) => {
  console.log("🎉 Route /me/nameday appelée !");
  try {
    const { nameday } = req.body;

    if (nameday && !/^\d{2}-\d{2}$/.test(nameday)) {
      return res.status(400).json({
        message: "Invalid nameday format. Use MM-DD (e.g., 03-13)",
      });
    }

    if (nameday) {
      const [month, day] = nameday.split("-").map(Number);
      if (month < 1 || month > 12 || day < 1 || day > 31) {
        return res.status(400).json({
          message: "Invalid date. Month must be 01-12, day must be 01-31",
        });
      }
    }

    const updatedUser = await userModel
      .findByIdAndUpdate(
        req.payload._id,
        { nameday: nameday || null },
        { new: true, runValidators: true },
      )
      .select("-password");

    if (!updatedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    console.log(
      `✅ Nameday updated for ${updatedUser.name}: ${nameday || "removed"}`,
    );

    return res.status(200).json({
      message: "Nameday updated successfully",
      nameday: updatedUser.nameday,
    });
  } catch (error) {
    console.error("Error updating nameday:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

/* PATCH /users/me/chat-email-prefs - Activer/désactiver emails chat par ami */
router.patch("/me/chat-email-prefs", isAuthenticated, async (req, res) => {
  const { friendId, enabled } = req.body;

  if (!friendId || typeof enabled !== "boolean") {
    return res
      .status(400)
      .json({ message: "friendId et enabled sont requis." });
  }

  try {
    const update = enabled
      ? { $pull: { chatEmailDisabledFriends: friendId } }
      : { $addToSet: { chatEmailDisabledFriends: friendId } };

    const user = await userModel.findByIdAndUpdate(req.payload._id, update, {
      new: true,
    });

    if (!user)
      return res.status(404).json({ message: "Utilisateur introuvable." });

    res.json({
      success: true,
      chatEmailDisabledFriends: user.chatEmailDisabledFriends,
    });
  } catch (err) {
    console.error("Erreur PATCH chat-email-prefs:", err);
    res.status(500).json({ message: "Erreur serveur." });
  }
});

// ─── E2E Encryption ──────────────────────────────────────────────────────────

/* PUT /users/keys — Stocker/mettre à jour publicKey + encryptedPrivateKey */
router.put("/keys", isAuthenticated, async (req, res) => {
  const { publicKey, encryptedPrivateKey } = req.body;

  if (!publicKey || !encryptedPrivateKey) {
    return res
      .status(400)
      .json({ message: "publicKey et encryptedPrivateKey sont requis." });
  }

  try {
    await userModel.findByIdAndUpdate(req.payload._id, {
      publicKey,
      encryptedPrivateKey,
    });
    return res.status(200).json({ message: "Clés E2E enregistrées." });
  } catch (err) {
    console.error("Erreur PUT /users/keys:", err);
    return res.status(500).json({ message: "Erreur serveur." });
  }
});

/* GET /users/:id/publicKey — Récupérer la clé publique d'un utilisateur */
router.get("/:id/publicKey", isAuthenticated, async (req, res) => {
  try {
    const user = await userModel.findById(req.params.id).select("publicKey");
    if (!user) {
      return res.status(404).json({ message: "Utilisateur non trouvé." });
    }
    return res.status(200).json({ publicKey: user.publicKey });
  } catch (err) {
    console.error("Erreur GET /users/:id/publicKey:", err);
    return res.status(500).json({ message: "Erreur serveur." });
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
    res.status(200).json(formatUser(user));
  } catch (error) {
    next(error);
  }
});

/* PATCH user by ID */
router.patch(
  "/:id",
  uploader.single("avatar"),
  isAuthenticated,
  logAction("account_update"),
  async (req, res, next) => {
    const { currentPassword, newPassword } = req.body;
    const avatar = req.file?.path || undefined;

    try {
      const user = await userModel.findById(req.params.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      if (req.payload._id.toString() !== req.params.id) {
        return res.status(403).json({
          message: "Vous ne pouvez modifier que votre propre compte",
        });
      }

      const oldName = user.name;
      const oldSurname = user.surname;
      const oldBirthDate = user.birthDate;

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
        const salt = bcrypt.genSaltSync(10);
        user.password = bcrypt.hashSync(newPassword, salt);

        // ── Re-chiffrement E2E : le front renvoie encryptedPrivateKey re-chiffrée
        if (req.body.encryptedPrivateKey) {
          user.encryptedPrivateKey = req.body.encryptedPrivateKey;
        }
      }

      user.username = req.body.username || user.username;
      user.name = req.body.name || user.name;
      user.surname =
        req.body.surname !== undefined ? req.body.surname : user.surname;
      user.email = req.body.email || user.email;
      user.birthDate = req.body.birthDate || user.birthDate;

      if (req.body.nameday !== undefined) {
        user.nameday = req.body.nameday || null;
      }

      if (avatar) user.avatar = avatar;

      // ── Onboarding ──────────────────────────────────────────────────────────
      if (req.body.onboardingDone !== undefined) {
        user.onboardingDone = req.body.onboardingDone;
      }

      // ── Préférences emails anniversaires ────────────────────────────────────
      if (req.body.receiveBirthdayEmails !== undefined) {
        user.receiveBirthdayEmails = req.body.receiveBirthdayEmails;
      }
      if (req.body.receiveFriendRequestEmails !== undefined) {
        user.receiveFriendRequestEmails = req.body.receiveFriendRequestEmails;
      }
      if (req.body.receiveOwnBirthdayEmail !== undefined) {
        user.receiveOwnBirthdayEmail = req.body.receiveOwnBirthdayEmail;
      }

      // ── Préférences emails chat ──────────────────────────────────────────────
      if (req.body.receiveChatEmails !== undefined) {
        user.receiveChatEmails = req.body.receiveChatEmails;
      }
      if (req.body.chatEmailFrequency !== undefined) {
        user.chatEmailFrequency = req.body.chatEmailFrequency;
      }

      // ── Préférences push ─────────────────────────────────────────────────────
      if (req.body.pushEnabled !== undefined) {
        user.pushEnabled = req.body.pushEnabled;
      }
      if (req.body.pushEvents !== undefined) {
        user.pushEvents = req.body.pushEvents;
      }
      if (req.body.pushBirthdayTimings !== undefined) {
        user.pushBirthdayTimings = req.body.pushBirthdayTimings;
      }

      const updatedUser = await user.save();

      const nameChanged = oldName !== updatedUser.name;
      const surnameChanged = oldSurname !== updatedUser.surname;
      const birthDateChanged =
        oldBirthDate?.toString() !== updatedUser.birthDate?.toString();

      if (nameChanged || surnameChanged || birthDateChanged) {
        console.log(`🔄 Synchronisation nécessaire pour ${updatedUser.name}`);
        try {
          const friendships = await Friend.find({
            $or: [
              { user: updatedUser._id, status: "accepted" },
              { friend: updatedUser._id, status: "accepted" },
            ],
          });
          let syncCount = 0;
          for (const friendship of friendships) {
            const friendId =
              friendship.user.toString() === updatedUser._id.toString()
                ? friendship.friend
                : friendship.user;
            const updateData = {};
            if (nameChanged) updateData.name = updatedUser.name;
            if (surnameChanged) updateData.surname = updatedUser.surname || "";
            if (birthDateChanged) updateData.date = updatedUser.birthDate;
            const result = await DateModel.findOneAndUpdate(
              { owner: friendId, linkedUser: updatedUser._id },
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
        }
      }

      const payload = formatUser(updatedUser);
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

/* DELETE user account - Soft delete avec anonymisation (RGPD) */
router.delete(
  "/:id",
  isAuthenticated,
  logAction("account_delete"),
  async (req, res, next) => {
    try {
      if (req.payload._id.toString() !== req.params.id) {
        return res.status(403).json({
          message: "Vous ne pouvez supprimer que votre propre compte",
        });
      }

      const user = await userModel.findById(req.params.id);
      if (!user) {
        return res.status(404).json({ message: "Utilisateur non trouvé" });
      }

      if (user.deletedAt) {
        return res
          .status(400)
          .json({ message: "Ce compte a déjà été supprimé" });
      }

      const anonymizedEmail = `deleted_${user._id}@birthreminder.deleted`;

      await userModel.findByIdAndUpdate(req.params.id, {
        deletedAt: new Date(),
        email: anonymizedEmail,
        name: "Utilisateur supprimé",
        surname: "",
        avatar: null,
        password: "DELETED",
        receiveBirthdayEmails: false,
        receiveFriendRequestEmails: false,
        receiveChatEmails: false,
      });

      await DateModel.deleteMany({ owner: req.params.id });
      await Friend.deleteMany({
        $or: [{ user: req.params.id }, { friend: req.params.id }],
      });

      res.status(200).json({
        message:
          "Compte désactivé avec succès. Vos données seront définitivement supprimées sous 30 jours.",
      });
    } catch (error) {
      console.error("Erreur lors de la suppression:", error);
      next(error);
    }
  },
);

module.exports = router;
