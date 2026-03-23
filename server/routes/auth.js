require("dotenv").config();
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const rateLimit = require("express-rate-limit");

const userModel = require("./../models/user.model");
const Log = require("../models/log.model");
const Invitation = require("../models/invitation.model");
const Friend = require("../models/friend.model");
const { isAuthenticated } = require("../middleware/jwt.middleware");
const {
  generateVerificationToken,
  sendVerificationEmail,
} = require("../services/verififcation");
const { createFriendDates } = require("../utils/friendDates");
const { findNameDay } = require("../utils/namedayHelper");
const {
  sendPasswordResetEmail,
} = require("../services/emailTemplates/passwordResetEmail");

const router = express.Router();
const saltRounds = 10;

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Trop de tentatives, réessayez dans 15 minutes." },
});

const validatePassword = (password) => {
  return /(?=.*\d)(?=.*[a-z])(?=.*[A-Z]).{6,}/.test(password);
};

// ========================================
// POST /auth/signup
// ========================================
router.post("/signup", async (req, res) => {
  const { email, password, name, surname } = req.body;

  if (!email || !password || !name || !surname) {
    return res
      .status(400)
      .json({ message: "Provide email, password, name and surname." });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return res
      .status(400)
      .json({ message: "Please provide a valid email address." });
  }

  if (!validatePassword(password)) {
    return res.status(400).json({
      message:
        "Password must have at least 6 characters and contain at least one number, one lowercase and one uppercase letter.",
    });
  }

  try {
    const foundUser = await userModel.findOne({ email });
    if (foundUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    const hashedPassword = bcrypt.hashSync(
      password,
      bcrypt.genSaltSync(saltRounds),
    );
    const verificationToken = generateVerificationToken();

    const nameday = findNameDay(name);

    const newUser = await userModel.create({
      email,
      password: hashedPassword,
      name,
      surname,
      birthDate: req.body.birthDate || null,
      nameday,
      avatar: `https://api.dicebear.com/8.x/bottts/svg?seed=${surname}`,
      verificationToken,
      isVerified: false,
    });

    if (nameday) {
      console.log(`✅ Fête détectée pour ${name}: ${nameday}`);
    } else {
      console.log(`ℹ️ Aucune fête trouvée pour ${name}`);
    }

    try {
      const ipAddress =
        req.headers["x-forwarded-for"]?.split(",")[0].trim() ||
        req.connection.remoteAddress;
      await Log.create({
        userId: newUser._id,
        action: "signup",
        ipAddress,
        userAgent: req.headers["user-agent"],
      });
    } catch (logError) {
      console.error("❌ Erreur logging:", logError);
    }

    try {
      const pendingInvitations = await Invitation.find({
        email: newUser.email,
        status: "pending",
      });

      for (const invitation of pendingInvitations) {
        await Friend.create({
          user: invitation.invitedBy,
          friend: newUser._id,
          status: "accepted",
          acceptedAt: Date.now(),
        });

        invitation.status = "accepted";
        await invitation.save();

        const inviter = await userModel.findById(invitation.invitedBy);
        if (inviter) {
          await createFriendDates(inviter, newUser);
        }

        console.log(
          `✅ Amitié + dates créées via invitation pour ${newUser.email}`,
        );
      }
    } catch (invitationError) {
      console.error("❌ Erreur traitement invitations:", invitationError);
    }

    await sendVerificationEmail(newUser.email, newUser.verificationToken);

    return res
      .status(201)
      .json({ message: "User created. Please verify your email address." });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// ========================================
// POST /auth/login
// ========================================
router.post("/login", authLimiter, async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: "Provide email and password." });
  }

  try {
    const foundUser = await userModel.findOne({ email });
    if (!foundUser) {
      return res.status(401).json({ message: "Utilisateur non trouvé." });
    }

    if (foundUser.deletedAt) {
      return res.status(401).json({ message: "Ce compte a été supprimé." });
    }

    if (!foundUser.isVerified) {
      const now = Date.now();
      const delay = 3600000;

      if (
        foundUser.lastVerificationEmailSent &&
        now - foundUser.lastVerificationEmailSent < delay
      ) {
        return res.status(401).json({
          message:
            "Un email de vérification vous a été envoyé afin de pouvoir vous connecter.",
        });
      }

      const verificationToken = generateVerificationToken();
      await sendVerificationEmail(foundUser.email, verificationToken);
      foundUser.verificationToken = verificationToken;
      foundUser.lastVerificationEmailSent = now;
      await foundUser.save();

      return res.status(401).json({
        message:
          "Veuillez vérifier vos emails avant de vous connecter. Un nouvel email de vérification a été envoyé.",
      });
    }

    const passwordCorrect = bcrypt.compareSync(password, foundUser.password);
    if (!passwordCorrect) {
      return res
        .status(401)
        .json({ message: "Unable to authenticate the user" });
    }

    try {
      const ipAddress =
        req.headers["x-forwarded-for"]?.split(",")[0].trim() ||
        req.connection.remoteAddress;
      await Log.create({
        userId: foundUser._id,
        action: "login",
        ipAddress,
        userAgent: req.headers["user-agent"],
      });
    } catch (logError) {
      console.error("❌ Erreur logging:", logError);
    }

    const { _id, email: userEmail, name, surname } = foundUser;
    const authToken = jwt.sign(
      { _id, email: userEmail, name, surname },
      process.env.TOKEN_SECRET,
      { algorithm: "HS256", expiresIn: "8h" },
    );

    res.cookie("authToken", authToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 8 * 60 * 60 * 1000,
    });

    return res.status(200).json({ authToken });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// ========================================
// GET /auth/verify
// ========================================
router.get("/verify", isAuthenticated, async (req, res) => {
  try {
    const user = await userModel.findById(req.payload._id).select("-password -resetToken -verificationToken");
    
    if (!user || user.deletedAt) {
      return res.status(401).json({ message: "User not found" });
    }

    const authToken = jwt.sign(
      { 
        _id: user._id, 
        email: user.email, 
        name: user.name, 
        surname: user.surname 
      },
      process.env.TOKEN_SECRET,
      { algorithm: "HS256", expiresIn: "8h" },
    );

    res.cookie("authToken", authToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 8 * 60 * 60 * 1000,
    });

    res.status(200).json({ ...user.toObject(), authToken });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ========================================
// POST /auth/logout
// ========================================
router.post("/logout", (req, res) => {
  res.clearCookie("authToken", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
  });
  res.status(200).json({ message: "Logged out" });
});

// ========================================
// POST /auth/forgot-password
// ========================================
router.post("/forgot-password", authLimiter, async (req, res) => {
  const { email } = req.body;

  try {
    const user = await userModel.findOne({ email });
    if (user) {
      const resetToken = crypto.randomBytes(20).toString("hex");
      user.resetToken = resetToken;
      user.resetTokenExpires = Date.now() + 3600000;
      await user.save();
      await sendPasswordResetEmail(email, resetToken);
    }
    // Toujours retourner 200 pour ne pas révéler si l'email existe
    return res.status(200).json({ message: "Si ce compte existe, un email de récupération a été envoyé." });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// ========================================
// POST /auth/reset/:token
// ========================================
router.post("/reset/:token", async (req, res) => {
  const { token } = req.params;
  const { password: newPassword, publicKey, encryptedPrivateKey } = req.body;

  if (!validatePassword(newPassword)) {
    return res.status(400).json({
      message:
        "Password must have at least 6 characters and contain at least one number, one lowercase and one uppercase letter.",
    });
  }

  try {
    const user = await userModel.findOne({ resetToken: token });

    if (!user || user.resetTokenExpires < Date.now()) {
      return res.status(400).json({ message: "Invalid or expired token" });
    }

    user.password = bcrypt.hashSync(
      newPassword,
      bcrypt.genSaltSync(saltRounds),
    );
    user.resetToken = null;
    user.resetTokenExpires = null;

    // ── Gestion des clés E2E après reset ─────────────────────────────────────
    if (publicKey && encryptedPrivateKey) {
      // Le front a fourni une nouvelle paire (cas où le userId était disponible)
      user.publicKey = publicKey;
      user.encryptedPrivateKey = encryptedPrivateKey;
    } else {
      // Mode standard : l'ancienne clé privée chiffrée n'est plus déchiffrable.
      // On la vide : au prochain login, le front détectera encryptedPrivateKey=null
      // et générera automatiquement une nouvelle paire de clés.
      user.encryptedPrivateKey = null;
      // publicKey conservée telle quelle (sera écrasée lors de la régénération)
    }

    await user.save();

    try {
      const ipAddress =
        req.headers["x-forwarded-for"]?.split(",")[0].trim() ||
        req.connection.remoteAddress;
      await Log.create({
        userId: user._id,
        action: "password_reset",
        ipAddress,
        userAgent: req.headers["user-agent"],
      });
    } catch (logError) {
      console.error("❌ Erreur logging:", logError);
    }

    return res.status(200).json({
      message: "Password has been reset",
      newKeysGenerated: !!(publicKey && encryptedPrivateKey),
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "Internal server error" });
  }
});

module.exports = router;
