const express = require("express");
const router = express.Router();
const userModel = require("../models/user.model");
const { isAuthenticated } = require("../middleware/jwt.middleware");
const uploader = require("../config/cloudinary");
const jwt = require("jsonwebtoken");

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
    };
    res.status(200).json(userToFront);
  } catch (error) {
    next(error);
  }
});

/* DELETE user by ID */
router.delete("/:id", isAuthenticated, async (req, res, next) => {
  try {
    const deleteUser = await userModel.findByIdAndDelete(req.params.id);
    console.log("deleted user is", deleteUser);
    res.status(200).json({ message: "successfully deleted user account" });
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
    const avatar = req.file?.path || undefined;
    try {
      const updatedUser = await userModel.findByIdAndUpdate(
        req.params.id,
        {
          ...req.body,
          avatar: avatar,
        },
        { new: true }
      );

      const payload = {
        _id: updatedUser._id,
        name: updatedUser.name,
        surname: updatedUser.surname,
        email: updatedUser.email,
        avatar: updatedUser.avatar,
        birthDate: updatedUser.birthDate,
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
