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

// POST  /auth/signup
router.post("/signup", (req, res, next) => {
  const { email, password, name, surname } = req.body;

  //Check if informations aure provided as empty string
  if (email === "" || password === "" || name === "" || surname === "") {
    res
      .status(400)
      .json({ message: "Provide email, password, name and surname." });
    return;
  }

  //   Regex validation email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  if (!emailRegex.test(email)) {
    res.status(400).json({ message: "Please provide a valid email address." });
    return;
  }

  //Use regex to validate the password format
  const passwordRegex = /(?=.*\d)(?=.*[a-z])(?=.*[A-Z]).{6,}/;
  if (!passwordRegex.test(password)) {
    res.status(400).json({
      message:
        "Password must have at least 6 characters and contain at least one number, one lowercase and one uppercase letter.",
    });
    return;
  }

  // Check the users collection if a user with the same email already exists
  userModel
    .findOne({ email })
    .then((foundUser) => {
      //if the user with tehe same email already exits, send an error response
      if (foundUser) {
        res.status(400).json({ message: "User already exist" });
        return;
      }

      //if email is unique, proced to hash the password
      const salt = bcrypt.genSaltSync(saltRounds);
      const hashedPassword = bcrypt.hashSync(password, salt);

      //Create the new user in the database
      //We return a pending promise, wich allows us to chain another 'then'

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
      // Deconstruct the newly created user object to omit the password
      // We should never expose passwords publicly
      const { email, name, surname, _id } = createdUser;

      // Create a new object that doesn't expose the password
      const user = { email, name, surname, _id };

      //send a json response containing the user object
      res.status(201).json({ user: user });
    })
    .catch((e) => {
      console.error(e, "herre");
      res.status(400).json({ message: "Internal server error" });
    });
});

// POST  /auth/login
router.post("/login", (req, res, next) => {
  const { email, password } = req.body;

  //check if email and password are provided as a empty string
  if (email === "" || password === "") {
    res.status(400).json({ message: "Provide email and password." });
    return;
  }

  // Check the users collection if a user with the same email exists
  userModel
    .findOne({ email })
    .then((foundUser) => {
      if (!foundUser) {
        // If the user is not found, send an error response
        res.status(401).json({ message: "User not found." });
        return;
      }

      //compare the provided password with the on saved in the database
      const passwordCorrect = bcrypt.compareSync(password, foundUser.password);

      if (passwordCorrect) {
        // Deconstruct the user object to omit the password
        const { _id, email, name, surname } = foundUser;

        // Create an object that will be set as the token payload
        const payload = { _id, email, name, surname };

        //create and sign the token
        const authToken = jwt.sign(payload, process.env.TOKEN_SECRET, {
          algorithm: "HS256",
          expiresIn: "6h",
        });

        //send the token as the response
        res.status(200).json({ authToken: authToken });
      } else {
        res.status(401).json({ message: "Unable to authenticate the user" });
      }
    })
    .catch((e) => {
      console.error(e);
    });
});

// GET  /auth/verify
router.get("/auth/verify", isAuthenticated, (req, res, next) => {
  // <== CREATE NEW ROUTE

  // If JWT token is valid the payload gets decoded by the
  // isAuthenticated middleware and made available on `req.payload`
  // console.log(`req.payload`, req.payload);

  // Send back the object with user data
  // previously set as the token payload
  res.status(200).json(req.payload);
});

// POST /auth/forgot-password
router.post("/forgot-password", (req, res, next) => {
  const { email } = req.body;

  userModel
    .findOne({ email })
    .then((user) => {
      if (!user) {
        return res.status(400).json({ message: "User not found" });
      }

      // Generate a reset token
      const resetToken = crypto.randomBytes(20).toString("hex");
      user.resetToken = resetToken;
      user.resetTokenExpires = { $gt: Date.now() }; // 1 heure dans le futur
      user.save();

      const transporter = nodemailer.createTransport({
        host: process.env.EMAIL_HOST,
        port: 587,
        service: "hotmail",
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS,
        },
        tls: {
          rejectUnauthorized: false,
        },
      });

      const mailOptions = {
        from: "pep_man@msn.com",
        to: email,
        subject: "Password Reset",
        text: `You are receiving this because you (or someone else) have requested the reset of the password for your account.\n\nPlease click on the following link, or paste this into your browser to complete the process:\n\nhttp://localhost:3000/auth/reset/${resetToken}\n\nIf you did not request this, please ignore this email and your password will remain unchanged.\n`,
      };

      transporter.sendMail(mailOptions, (error, response) => {
        if (error) {
          console.log(error);
        } else {
          res.status(200).json({ message: "Recovery email sent" });
        }
      });
    })
    .catch((e) => {
      console.error(e);
      res.status(400).json({ message: "Internal server error" });
    });
});

// POST /auth/reset/:token
router.post("/reset/:token", async (req, res, next) => {
  const token = req.params.token;
  const newPassword = req.body.password;

  // Find the user with the reset token
  userModel
    .findOne({ resetToken: token })
    .then(async (user) => {
      if (!user) {
        // If no user is found, the token is not valid
        return res.status(400).json({ message: "Invalid token" });
      }

      // Update the user's password
      const salt = bcrypt.genSaltSync(saltRounds);
      const hashedPassword = bcrypt.hashSync(newPassword, salt);
      user.password = hashedPassword;
      user.resetToken = null; // Remove the reset token
      await user.save();

      res.status(200).json({ message: "Password has been reset" });
    })
    .catch((e) => {
      console.error(e);
      res.status(400).json({ message: "Internal server error" });
    });
});

module.exports = router;
