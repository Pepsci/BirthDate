const express = require("express");
const router = express.Router();
const dateModel = require("./../models/date.model");
const mongoose = require("mongoose");
const userModel = require("../models/user.model");

router.get("/", async (req, res, next) => {
  try {
    const ownerId = req.query.owner;
    const dateList = ownerId
      ? await dateModel.find({ owner: ownerId }).populate("owner")
      : await dateModel.find().populate("owner");
    res.status(200).json(dateList);
  } catch (error) {
    console.error("Error fetching date list:", error);
    res.status(500).json({ message: "internal Server Error" });
  }
});

router.post("/", async (req, res, next) => {
  const { date, owner, name, surname, family } = req.body;
  try {
    const newDate = await dateModel.create({
      date,
      owner,
      name,
      surname,
      family,
    });
    res.status(201).json(newDate);
  } catch (error) {
    console.error("Error creating date:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid Date ID" });
    }
    const date = await dateModel.findById(req.params.id).populate("owner");
    if (!date) {
      return res.status(404).json({ message: "Date not found" });
    }
    res.status(200).json(date);
  } catch (error) {
    console.error("Error fetching date:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

router.patch("/:id", async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid Date ID" });
    }
    const { date, owner, name, surname, family, giftName, purchased } =
      req.body;
    const updateFields = { date, owner, name, surname, family };

    if (giftName && purchased !== undefined) {
      updateFields.$push = { gifts: { giftName, purchased } };
    }

    const updatedDate = await dateModel.findByIdAndUpdate(
      req.params.id,
      updateFields,
      { new: true }
    );
    if (!updatedDate) {
      return res.status(404).json({ message: "Date not found" });
    }
    res.status(200).json(updatedDate);
  } catch (error) {
    console.error("Error updating date:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

router.patch("/:id/gifts", async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid Date ID" });
    }
    const { giftName, purchased } = req.body;
    const updatedDate = await dateModel.findByIdAndUpdate(
      req.params.id,
      { $push: { gifts: { giftName, purchased } } },
      { new: true }
    );
    if (!updatedDate) {
      return res.status(404).json({ message: "Date not found" });
    }
    console.log("Updated Date:", updatedDate); // Ajoutez ceci
    res.status(200).json(updatedDate);
  } catch (error) {
    console.error("Error updating date:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

router.patch("/:id/gifts/:giftId", async (req, res, next) => {
  try {
    if (
      !mongoose.isValidObjectId(req.params.id) ||
      !mongoose.isValidObjectId(req.params.giftId)
    ) {
      return res.status(400).json({ message: "Invalid Date ID or Gift ID" });
    }
    const { giftName, purchased } = req.body;
    const updatedDate = await dateModel.findOneAndUpdate(
      { _id: req.params.id, "gifts._id": req.params.giftId },
      {
        $set: { "gifts.$.giftName": giftName, "gifts.$.purchased": purchased },
      },
      { new: true }
    );
    if (!updatedDate) {
      return res.status(404).json({ message: "Date or Gift not found" });
    }
    res.status(200).json(updatedDate);
  } catch (error) {
    console.error("Error updating gift:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

router.delete("/:id/gifts/:giftId", async (req, res, next) => {
  try {
    if (
      !mongoose.isValidObjectId(req.params.id) ||
      !mongoose.isValidObjectId(req.params.giftId)
    ) {
      return res.status(400).json({ message: "Invalid Date ID or Gift ID" });
    }
    const updatedDate = await dateModel.findByIdAndUpdate(
      req.params.id,
      { $pull: { gifts: { _id: req.params.giftId } } },
      { new: true }
    );
    if (!updatedDate) {
      return res.status(404).json({ message: "Date or Gift not found" });
    }
    res.status(200).json(updatedDate);
  } catch (error) {
    console.error("Error deleting gift:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid Date ID" });
    }
    const deleteDate = await dateModel.findByIdAndDelete(req.params.id);
    if (!deleteDate) {
      return res.status(404).json({ message: "Date not found" });
    }
    res.status(200).json(deleteDate);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
