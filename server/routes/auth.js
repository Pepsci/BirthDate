require("dotenv").config();
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const userModel = require("./../models/user.model");
const { isAuthenticated } = require("../middleware/jwt.middleware");

const router = express.Router();
const saltRounds = 10;

const crypto = require("crypto");
const nodemailer = require("nodemailer");
// const sesTransport = require("nodemailer-ses-transport");
const { SESClient, SendRawEmailCommand } = require("@aws-sdk/client-ses");

// Configuration de AWS SDK v3
const ses = new SESClient({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

// Création du transporteur Nodemailer avec Amazon SES et nodemailer-ses-transport
const transporter = nodemailer.createTransport({
  SES: { ses, aws: { SendRawEmailCommand } },
});

// Fonction pour envoyer l'email de réinitialisation
async function sendEmail(email, token) {
  try {
    const mailOptions = {
      from: "reset_password@birthreminder.com",
      to: email,
      subject: "Password Reset",
      text: `Cliquez ici : ${process.env.FRONTEND_URL}/auth/reset/${token}`,
    };

    console.log("Envoi de l'email...");
    await transporter.sendMail(mailOptions);
    console.log("Email envoyé avec succès !");
  } catch (error) {
    console.error("Erreur lors de l'envoi de l'email :", error);
    throw new Error("Échec de l'envoi de l'email");
  }
}

// POST /auth/signup
router.post("/signup", (req, res, next) => {
  const { email, password, name, surname } = req.body;

  if (email === "" || password === "" || name === "" || surname === "") {
    res
      .status(400)
      .json({ message: "Provide email, password, name and surname." });
    return;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  if (!emailRegex.test(email)) {
    res.status(400).json({ message: "Please provide a valid email address." });
    return;
  }

  const passwordRegex = /(?=.*\d)(?=.*[a-z])(?=.*[A-Z]).{6,}/;
  if (!passwordRegex.test(password)) {
    res.status(400).json({
      message:
        "Password must have at least 6 characters and contain at least one number, one lowercase and one uppercase letter.",
    });
    return;
  }

  userModel
    .findOne({ email })
    .then((foundUser) => {
      if (foundUser) {
        res.status(400).json({ message: "User already exist" });
        return;
      }

      const salt = bcrypt.genSaltSync(saltRounds);
      const hashedPassword = bcrypt.hashSync(password, salt);

      const avatar = `https://api.dicebear.com/8.x/bottts/svg?seed=${surname}`;

      return userModel.create({
        email,
        password: hashedPassword,
        name,
        surname,
        avatar,
      });
    })
    .then((createdUser) => {
      const { email, name, surname, _id } = createdUser;
      const user = { email, name, surname, _id };
      res.status(201).json({ user: user });
    })
    .catch((e) => {
      console.error(e, "herre");
      res.status(400).json({ message: "Internal server error" });
    });
});

// POST /auth/login
router.post("/login", (req, res, next) => {
  const { email, password } = req.body;

  if (email === "" || password === "") {
    res.status(400).json({ message: "Provide email and password." });
    return;
  }

  userModel
    .findOne({ email })
    .then((foundUser) => {
      if (!foundUser) {
        res.status(401).json({ message: "User not found." });
        return;
      }

      const passwordCorrect = bcrypt.compareSync(password, foundUser.password);

      if (passwordCorrect) {
        const { _id, email, name, surname } = foundUser;
        const payload = { _id, email, name, surname };
        const authToken = jwt.sign(payload, process.env.TOKEN_SECRET, {
          algorithm: "HS256",
          expiresIn: "6h",
        });

        res.status(200).json({ authToken: authToken });
      } else {
        res.status(401).json({ message: "Unable to authenticate the user" });
      }
    })
    .catch((e) => {
      console.error(e);
    });
});

// GET /auth/verify
router.get("/auth/verify", isAuthenticated, (req, res, next) => {
  res.status(200).json(req.payload);
});

// POST /auth/forgot-password
router.post("/forgot-password", async (req, res, next) => {
  const { email } = req.body;

  try {
    const user = await userModel.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "User not found" });
    }

    const resetToken = crypto.randomBytes(20).toString("hex");
    user.resetToken = resetToken;
    user.resetTokenExpires = Date.now() + 3600000; // 1 heure
    await user.save();

    await sendEmail(email, resetToken);
    res.status(200).json({ message: "Recovery email sent" });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /auth/reset/:token
router.post("/reset/:token", async (req, res, next) => {
  const token = req.params.token;
  const newPassword = req.body.password;

  userModel
    .findOne({ resetToken: token })
    .then(async (user) => {
      if (!user || user.resetTokenExpires < Date.now()) {
        return res.status(400).json({ message: "Invalid or expired token" });
      }

      const salt = bcrypt.genSaltSync(saltRounds);
      const hashedPassword = bcrypt.hashSync(newPassword, salt);
      user.password = hashedPassword;
      user.resetToken = null;
      user.resetTokenExpires = null;
      await user.save();

      res.status(200).json({ message: "Password has been reset" });
    })
    .catch((e) => {
      console.error(e);
      res.status(500).json({ message: "Internal server error" });
    });
});

module.exports = router;
