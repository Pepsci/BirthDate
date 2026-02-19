require("dotenv").config();
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const { SESClient, SendRawEmailCommand } = require("@aws-sdk/client-ses");

const userModel = require("./../models/user.model");
const Log = require("../models/log.model");
const Invitation = require("../models/invitation.model");
const Friend = require("../models/friend.model");
const { isAuthenticated } = require("../middleware/jwt.middleware");
const {
  generateVerificationToken,
  sendVerificationEmail,
} = require("../services/verififcation");
const { createFriendDates } = require("../utils/friendDates"); // ✅ import utilitaire

const router = express.Router();
const saltRounds = 10;

const ses = new SESClient({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const transporter = nodemailer.createTransport({
  SES: { ses, aws: { SendRawEmailCommand } },
});

async function sendEmail(email, token) {
  try {
    await transporter.sendMail({
      from: "reset_password@birthreminder.com",
      to: email,
      subject: "Password Reset",
      text: `Cliquez ici : ${process.env.FRONTEND_URL}/auth/reset/${token}`,
    });
    console.log("Email envoyé avec succès !");
  } catch (error) {
    console.error("Erreur lors de l'envoi de l'email :", error);
    throw new Error("Échec de l'envoi de l'email");
  }
}

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

    const newUser = await userModel.create({
      email,
      password: hashedPassword,
      name,
      surname,
      avatar: `https://api.dicebear.com/8.x/bottts/svg?seed=${surname}`,
      verificationToken,
      isVerified: false,
    });

    // 📊 LOG
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

    // ✅ Traitement des invitations en attente
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

        // ✅ Création des dates des deux côtés via l'utilitaire
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
router.post("/login", async (req, res) => {
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

    // 📊 LOG
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
      { algorithm: "HS256", expiresIn: "24h" },
    );

    return res.status(200).json({ authToken });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// ========================================
// GET /auth/verify
// ========================================
router.get("/verify", isAuthenticated, (req, res) => {
  res.status(200).json(req.payload);
});

// ========================================
// POST /auth/forgot-password
// ========================================
router.post("/forgot-password", async (req, res) => {
  const { email } = req.body;

  try {
    const user = await userModel.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "User not found" });
    }

    const resetToken = crypto.randomBytes(20).toString("hex");
    user.resetToken = resetToken;
    user.resetTokenExpires = Date.now() + 3600000;
    await user.save();

    await sendEmail(email, resetToken);
    return res.status(200).json({ message: "Recovery email sent" });
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
  const { password: newPassword } = req.body;

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
    await user.save();

    // 📊 LOG
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

    return res.status(200).json({ message: "Password has been reset" });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "Internal server error" });
  }
});

module.exports = router;
