const express = require("express");
const router = express.Router();
const userModel = require("../models/user.model");
const Friend = require("../models/friend.model");
const DateModel = require("../models/date.model");
const Conversation = require("../models/conversation.model");
const { isAuthenticated } = require("../middleware/jwt.middleware");
const { logAction } = require("../middleware/logger.middleware");
const rateLimit = require("express-rate-limit");
const { ipKeyGenerator } = require("express-rate-limit");
const {
  avatarUploader,
  saveAvatar,
  removeAvatarFiles,
} = require("../config/avatarStorage");

// ─── Rate-limit sur l'upload d'avatar ────────────────────────────────────────
// Motif : le re-encodage sharp est l'opération la plus coûteuse en CPU de
// toute l'API. Sans garde-fou, un compte authentifié peut saturer le serveur
// en bouclant sur PATCH /users/me avec une image de 5 Mo.
//
// Ce limiteur ne protège PAS contre les uploads concurrents : cette garantie
// vient du nom de fichier déterministe dans avatarStorage.js, qui rend
// l'existence de deux avatars impossible quel que soit le nombre de process.
//
// `skip` : seules les requêtes portant réellement un fichier sont comptées —
// le formulaire de profil envoie toujours un FormData, même sans photo.
// Le limiteur doit donc être monté APRÈS multer pour que req.file existe.
const avatarUploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => !req.file,
  keyGenerator: (req) =>
    req.payload?._id ? String(req.payload._id) : ipKeyGenerator(req),
  message: {
    message: "Trop de changements de photo de profil. Réessayez dans une heure.",
  },
});
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
    receiveNamedayEmails: user.receiveNamedayEmails,
    monthlyRecap: user.monthlyRecap,
    // Réglages d'affichage
    hideNamedaysOnCards: user.hideNamedaysOnCards,
    showTodayNamedayOnHome: user.showTodayNamedayOnHome,
    // Emails chat
    receiveChatEmails: user.receiveChatEmails,
    chatEmailFrequency: user.chatEmailFrequency,
    chatEmailDisabledFriends: user.chatEmailDisabledFriends,
    // Emails événements
    receiveEventEmails: user.receiveEventEmails,
    eventEmailTimings: user.eventEmailTimings,
    // Push
    pushEnabled: user.pushEnabled,
    pushEvents: user.pushEvents,
    pushBirthdayTimings: user.pushBirthdayTimings,
    pushEventTimings: user.pushEventTimings,
    // E2E
    publicKey: user.publicKey,
    encryptedPrivateKey: user.encryptedPrivateKey,
    oldPublicKey: user.oldPublicKey,
    oldEncryptedPrivateKey: user.oldEncryptedPrivateKey,
    encryptedSeedPhrase: user.encryptedSeedPhrase,
    e2eMode: user.e2eMode,
    e2eActivatedAt: user.e2eActivatedAt,
  };
}

// ─── Helper : appliquer les préférences communes aux deux routes PATCH ────────
function applyPreferences(user, body) {
  // Onboarding
  if (body.onboardingDone !== undefined)
    user.onboardingDone = body.onboardingDone;

  // Emails anniversaires
  if (body.receiveBirthdayEmails !== undefined)
    user.receiveBirthdayEmails = body.receiveBirthdayEmails;
  if (body.receiveFriendRequestEmails !== undefined)
    user.receiveFriendRequestEmails = body.receiveFriendRequestEmails;
  if (body.receiveOwnBirthdayEmail !== undefined)
    user.receiveOwnBirthdayEmail = body.receiveOwnBirthdayEmail;
  if (body.receiveNamedayEmails !== undefined)
    user.receiveNamedayEmails = body.receiveNamedayEmails;
  if (body.monthlyRecap !== undefined) user.monthlyRecap = body.monthlyRecap;

  // Réglages d'affichage
  if (body.hideNamedaysOnCards !== undefined)
    user.hideNamedaysOnCards = body.hideNamedaysOnCards;
  if (body.showTodayNamedayOnHome !== undefined)
    user.showTodayNamedayOnHome = body.showTodayNamedayOnHome;

  // Emails chat
  if (body.receiveChatEmails !== undefined)
    user.receiveChatEmails = body.receiveChatEmails;
  if (body.chatEmailFrequency !== undefined)
    user.chatEmailFrequency = body.chatEmailFrequency;

  // Emails événements
  if (body.receiveEventEmails !== undefined)
    user.receiveEventEmails = body.receiveEventEmails;
  if (body.eventEmailTimings !== undefined)
    user.eventEmailTimings = body.eventEmailTimings;

  // Push
  if (body.pushEnabled !== undefined) user.pushEnabled = body.pushEnabled;
  if (body.pushEvents !== undefined) user.pushEvents = body.pushEvents;
  if (body.pushBirthdayTimings !== undefined)
    user.pushBirthdayTimings = body.pushBirthdayTimings;
  if (body.pushEventTimings !== undefined)
    user.pushEventTimings = body.pushEventTimings;
}

// ─── Helper : synchroniser les dates amis si nom/prénom/date ont changé ──────
async function syncFriendDates(updatedUser, oldName, oldSurname, oldBirthDate) {
  const nameChanged = oldName !== updatedUser.name;
  const surnameChanged = oldSurname !== updatedUser.surname;
  const birthDateChanged =
    oldBirthDate?.toString() !== updatedUser.birthDate?.toString();

  if (!nameChanged && !surnameChanged && !birthDateChanged) return;

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
    console.log(`✅ ${syncCount}/${friendships.length} dates synchronisées`);
  } catch (syncError) {
    console.error("❌ Erreur lors de la synchronisation:", syncError);
  }
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
  isAuthenticated,
  avatarUploader.single("avatar"),
  avatarUploadLimiter,
  logAction("account_update"),
  async (req, res, next) => {
    const { currentPassword, newPassword } = req.body;

    try {
      console.log("PATCH /users/me - User ID:", req.payload._id);
      console.log("🔍 [DEBUG] req.body complet:", req.body);

      // Avatar : re-encodé en WebP 256×256 puis écrit sur le disque.
      // saveAvatar() supprime l'avatar précédent → un seul fichier par user.
      let avatar;
      if (req.file) {
        const saved = await saveAvatar(req.payload._id, req.file.buffer);
        avatar = saved.url;
      }

      const user = await userModel.findById(req.payload._id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const oldName = user.name;
      const oldSurname = user.surname;
      const oldBirthDate = user.birthDate;

      // Mot de passe
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

      if (avatar) {
        user.avatar = avatar;
      } else if (req.body.removeAvatar === "true") {
        // Suppression de la photo → retour à l'avatar DiceBear généré,
        // identique à celui attribué à l'inscription.
        await removeAvatarFiles(req.payload._id);
        user.avatar = `https://api.dicebear.com/8.x/bottts/svg?seed=${encodeURIComponent(
          user.surname || user.name || "user",
        )}`;
      }

      // Toutes les préférences
      applyPreferences(user, req.body);

      console.log("🔍 [DEBUG] user AVANT save():", {
        showTodayNamedayOnHome: user.showTodayNamedayOnHome,
        receiveNamedayEmails: user.receiveNamedayEmails,
        modifiedPaths: user.modifiedPaths(),
      });
      const updatedUser = await user.save();

      await syncFriendDates(updatedUser, oldName, oldSurname, oldBirthDate);

      console.log("🔍 [DEBUG] updatedUser APRES save():", {
        showTodayNamedayOnHome: updatedUser.showTodayNamedayOnHome,
        receiveNamedayEmails: updatedUser.receiveNamedayEmails,
      });
      const rereadDebugUser = await userModel.findById(updatedUser._id);
      console.log("🔍 [DEBUG] relu depuis Mongo juste apres:", {
        showTodayNamedayOnHome: rereadDebugUser.showTodayNamedayOnHome,
        receiveNamedayEmails: rereadDebugUser.receiveNamedayEmails,
      });
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

/* PUT /users/keys — Stocker/mettre à jour la paire de clés E2E. */
router.put("/keys", isAuthenticated, async (req, res) => {
  const { publicKey, encryptedPrivateKey, e2eMode, encryptedSeedPhrase } =
    req.body;

  if (!publicKey || !encryptedPrivateKey) {
    return res
      .status(400)
      .json({ message: "publicKey et encryptedPrivateKey sont requis." });
  }

  try {
    const user = await userModel.findById(req.payload._id);
    if (!user) {
      return res.status(404).json({ message: "Utilisateur non trouvé." });
    }

    if (user.publicKey) {
      user.oldPublicKey = user.publicKey;
      user.oldEncryptedPrivateKey = user.encryptedPrivateKey ?? null;
    }

    user.publicKey = publicKey;
    user.encryptedPrivateKey = encryptedPrivateKey;

    if (e2eMode === "full") {
      user.e2eMode = "full";
      user.e2eActivatedAt = new Date();
      if (encryptedSeedPhrase) user.encryptedSeedPhrase = encryptedSeedPhrase;
    } else if (e2eMode === "standard") {
      user.e2eMode = "standard";
      user.e2eActivatedAt = null;
      user.encryptedSeedPhrase = null;
    }

    await user.save();

    try {
      const io = req.app.get("io");
      const connectedUsers = req.app.get("connectedUsers");
      if (io && connectedUsers) {
        const friendships = await Friend.find({
          $or: [
            { user: req.payload._id, status: "accepted" },
            { friend: req.payload._id, status: "accepted" },
          ],
        });
        const userId = req.payload._id.toString();
        friendships.forEach(({ user: fUser, friend }) => {
          const friendId =
            fUser.toString() === userId ? friend.toString() : fUser.toString();
          const socketId = connectedUsers.get(friendId);
          if (socketId) {
            io.to(socketId).emit("contact:keyUpdated", {
              userId,
              newPublicKey: publicKey,
            });
          }
        });
      }
    } catch (notifyErr) {
      console.error("Erreur notification contact:keyUpdated:", notifyErr);
    }

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
  isAuthenticated,
  avatarUploader.single("avatar"),
  avatarUploadLimiter,
  logAction("account_update"),
  async (req, res, next) => {
    const { currentPassword, newPassword } = req.body;

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

      // Avatar : traité APRÈS le contrôle de propriété, pour ne rien écrire
      // sur le disque si l'appelant n'est pas le propriétaire du compte.
      let avatar;
      if (req.file) {
        const saved = await saveAvatar(req.params.id, req.file.buffer);
        avatar = saved.url;
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

      if (avatar) {
        user.avatar = avatar;
      } else if (req.body.removeAvatar === "true") {
        // Suppression de la photo → retour à l'avatar DiceBear généré.
        await removeAvatarFiles(req.params.id);
        user.avatar = `https://api.dicebear.com/8.x/bottts/svg?seed=${encodeURIComponent(
          user.surname || user.name || "user",
        )}`;
      }

      // Toutes les préférences
      applyPreferences(user, req.body);

      const updatedUser = await user.save();

      await syncFriendDates(updatedUser, oldName, oldSurname, oldBirthDate);

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

      // Suppression immédiate du fichier avatar (RGPD : la photo est une
      // donnée personnelle, elle n'a pas à survivre 30 jours à la demande
      // de suppression, contrairement aux données nécessaires à un éventuel
      // rétablissement du compte).
      await removeAvatarFiles(user._id);

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

      // Conversations : on efface pour LA SEULE personne qui part, avec le
      // même mécanisme que « retirer de ma liste ». Détruire les fils
      // reviendrait à effacer la correspondance de gens qui n'ont rien
      // demandé, et permettrait à quelqu'un de supprimer son compte pour faire
      // disparaître les preuves d'un harcèlement signalé.
      // Les messages restants seront purgés 12 mois après que l'autre aura
      // lui aussi retiré la conversation (jobs/purgeClearedConversations.js).
      await Conversation.updateMany(
        { participants: req.params.id, "clears.user": { $ne: req.params.id } },
        { $push: { clears: { user: req.params.id, at: new Date() } } },
      );
      await Conversation.updateMany(
        { participants: req.params.id, "clears.user": req.params.id },
        { $set: { "clears.$.at": new Date() } },
      );

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
