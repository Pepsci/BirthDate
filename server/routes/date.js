const express = require("express");
const router = express.Router();
const dateModel = require("./../models/date.model");

router.get("/", async (req, res, next) => {
  try {
    const ownerId = req.query.owner;
    const dateList = ownerId
      ? await dateModel.find({ owner: ownerId })
      : await dateModel.find();
    res.status(200).json(dateList);
  } catch (error) {
    console.error("Error fetching date list:", error);
    res.status(500).json({ message: "internal Server Error" });
  }
});

router.post("/", async (req, res, next) => {
  const { date, owner, name, surname } = req.body;
  try {
    const newDate = await dateModel.create({ date, owner, name, surname });
    res.status(201).json(newDate);
  } catch (error) {
    console.error("Error fetching date list:", error);

    res.status(500).json({ message: "Internal Server Error" });
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const date = await dateModel.findById(req.params.id).populate("owner");
    res.status(200).json(date);
  } catch (error) {
    console.error("Error fetching date list:", error);

    res.status(500).json({ message: "Internal Message Error" });
  }
});

// router.patch("/:id", (req, res, next) => {});

router.delete("/:id", async (req, res, next) => {
  try {
    const deleteDate = await dateModel.findByIdAndDelete(req.params.id);
    res.status(200).json(deleteDate);
  } catch (error) {
    next(error);
  }
});

// router.get("/:id/dates", async (req, res, next) => {});

// router.patch("/dates/:id", async (req, res, next) => {});

module.exports = router;
