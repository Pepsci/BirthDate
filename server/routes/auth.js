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
  return (
    typeof password === "string" &&
    /(?=.*\d)(?=.*[a-z])(?=.*[A-Z]).{8,}/.test(password)
  );
};

// ========================================
// POST /auth/signup
// ========================================
router.post("/signup", async (req, res) => {
  const { email, password, name, surname, birthDate, acceptedTerms } = req.body;

  // CGU « tolérance zéro » (conformité Apple 1.2) — requis si le client l'envoie explicitement à false
  if (acceptedTerms === false) {
    return res
      .status(400)
      .json({ message: "Vous devez accepter les conditions d'utilisation." });
  }

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

  // La date de naissance est obligatoire : elle doit être une date valide et non future.
  const parsedBirthDate = birthDate ? new Date(birthDate) : null;
  if (
    !parsedBirthDate ||
    isNaN(parsedBirthDate.getTime()) ||
    parsedBirthDate > new Date()
  ) {
    return res
      .status(400)
      .json({ message: "Please provide a valid birth date." });
  }

  // RGPD France : consentement autonome aux services en ligne à partir de 15 ans
  // (art. 7-1 loi Informatique et Libertés). Déclaré aussi dans les
  // questionnaires d'âge App Store / Play Store — garder cohérent.
  const MIN_AGE = 15;
  const ageLimit = new Date();
  ageLimit.setFullYear(ageLimit.getFullYear() - MIN_AGE);
  if (parsedBirthDate > ageLimit) {
    return res.status(400).json({
      message: `Tu dois avoir au moins ${MIN_AGE} ans pour créer un compte BirthReminder.`,
    });
  }

  if (!validatePassword(password)) {
    return res.status(400).json({
      message:
        "Password must have at least 8 characters and contain at least one number, one lowercase and one uppercase letter.",
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
      birthDate: parsedBirthDate,
      nameday,
      avatar: `https://api.dicebear.com/8.x/bottts/svg?seed=${surname}`,
      verificationToken,
      isVerified: false,
      ...(acceptedTerms ? { acceptedTermsAt: new Date() } : {}),
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
  const { email, password, rememberMe } = req.body;

  if (
    !email ||
    !password ||
    typeof email !== "string" ||
    typeof password !== "string"
  ) {
    return res.status(400).json({ message: "Provide email and password." });
  }

  try {
    const foundUser = await userModel.findOne({ email });
    if (!foundUser) {
      return res
        .status(401)
        .json({ message: "Email ou mot de passe incorrect." });
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
        .json({ message: "Email ou mot de passe incorrect." });
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
    const tokenDuration = rememberMe ? "30d" : "8h";
    const cookieMaxAge = rememberMe
      ? 30 * 24 * 60 * 60 * 1000
      : 8 * 60 * 60 * 1000;

    const authToken = jwt.sign(
      { _id, email: userEmail, name, surname },
      process.env.TOKEN_SECRET,
      { algorithm: "HS256", expiresIn: tokenDuration },
    );

    res.cookie("authToken", authToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: cookieMaxAge,
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
    const user = await userModel
      .findById(req.payload._id)
      .select("-password -resetToken -verificationToken");

    if (!user || user.deletedAt) {
      return res.status(401).json({ message: "User not found" });
    }

    // Conserver la durée du token original
    const originalExp = req.payload.exp;
    const now = Math.floor(Date.now() / 1000);
    const remainingSeconds = originalExp - now;

    // Si moins d'1h restante, on prolonge selon la durée originale
    const originalDuration = originalExp - req.payload.iat;
    const isLongToken = originalDuration > 8 * 3600; // > 8h = rememberMe

    const tokenDuration = isLongToken ? "30d" : "8h";
    const cookieMaxAge = isLongToken
      ? 30 * 24 * 60 * 60 * 1000
      : 8 * 60 * 60 * 1000;

    const authToken = jwt.sign(
      {
        _id: user._id,
        email: user.email,
        name: user.name,
        surname: user.surname,
      },
      process.env.TOKEN_SECRET,
      { algorithm: "HS256", expiresIn: tokenDuration },
    );

    res.cookie("authToken", authToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: cookieMaxAge,
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
      const resetToken = crypto.randomBytes(32).toString("hex");
      // On ne stocke que le HASH du token en base ; le token en clair part par email.
      user.resetToken = crypto
        .createHash("sha256")
        .update(resetToken)
        .digest("hex");
      user.resetTokenExpires = Date.now() + 3600000;
      await user.save();
      await sendPasswordResetEmail(email, resetToken);
    }
    // Toujours retourner 200 pour ne pas révéler si l'email existe
    return res.status(200).json({
      message: "Si ce compte existe, un email de récupération a été envoyé.",
    });
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
        "Password must have at least 8 characters and contain at least one number, one lowercase and one uppercase letter.",
    });
  }

  try {
    const hashedToken = crypto
      .createHash("sha256")
      .update(String(token))
      .digest("hex");
    const user = await userModel.findOne({ resetToken: hashedToken });

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
