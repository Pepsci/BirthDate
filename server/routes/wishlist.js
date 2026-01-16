const express = require("express");
const router = express.Router();
const WishlistModel = require("../models/wishlist.model");
const UserModel = require("../models/user.model");
const mongoose = require("mongoose");

// GET /api/wishlist - Obtenir MA wishlist complète
router.get("/", async (req, res, next) => {
  try {
    const userId = req.query.userId; // Récupérer userId depuis les query params

    if (!userId) {
      return res.status(400).json({ message: "userId requis" });
    }

    const items = await WishlistModel.find({ userId }).sort({
      isPurchased: 1,
      createdAt: -1,
    });

    res.status(200).json({
      success: true,
      count: items.length,
      data: items,
    });
  } catch (error) {
    console.error("Erreur lors de la récupération de la wishlist:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// POST /api/wishlist - Créer un nouvel item
router.post("/", async (req, res, next) => {
  try {
    const { userId, title, price, url, isShared } = req.body;

    if (!userId || !title) {
      return res.status(400).json({ message: "userId et title requis" });
    }

    const item = await WishlistModel.create({
      userId,
      title,
      price,
      url,
      isShared: isShared || false,
    });

    res.status(201).json({
      success: true,
      data: item,
    });
  } catch (error) {
    console.error("Erreur lors de la création de l'item:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// GET /api/wishlist/user/:userId - Voir la wishlist d'un ami
router.get("/user/:userId", async (req, res, next) => {
  try {
    const { userId } = req.params;

    if (!mongoose.isValidObjectId(userId)) {
      return res.status(400).json({ message: "Invalid User ID" });
    }

    // Vérifier que l'utilisateur existe
    const targetUser = await UserModel.findById(userId).select(
      "name surname avatar"
    );

    if (!targetUser) {
      return res.status(404).json({ message: "Utilisateur non trouvé" });
    }

    // Récupérer seulement les items partagés
    const items = await WishlistModel.find({
      userId,
      isShared: true,
    })
      .populate("purchasedBy", "name surname avatar")
      .sort({ isPurchased: 1, createdAt: -1 });

    res.status(200).json({
      success: true,
      count: items.length,
      user: targetUser,
      data: items,
    });
  } catch (error) {
    console.error("Erreur lors de la récupération de la wishlist:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// GET /api/wishlist/:id - Obtenir un item spécifique
router.get("/:id", async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid Item ID" });
    }

    const item = await WishlistModel.findById(req.params.id);

    if (!item) {
      return res.status(404).json({ message: "Item non trouvé" });
    }

    res.status(200).json({
      success: true,
      data: item,
    });
  } catch (error) {
    console.error("Erreur lors de la récupération de l'item:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// PATCH /api/wishlist/:id - Modifier un item
router.patch("/:id", async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid Item ID" });
    }

    const { title, price, url, isShared } = req.body;

    const updatedItem = await WishlistModel.findByIdAndUpdate(
      req.params.id,
      { title, price, url, isShared },
      { new: true }
    );

    if (!updatedItem) {
      return res.status(404).json({ message: "Item non trouvé" });
    }

    res.status(200).json({
      success: true,
      data: updatedItem,
    });
  } catch (error) {
    console.error("Erreur lors de la mise à jour de l'item:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// DELETE /api/wishlist/:id - Supprimer un item
router.delete("/:id", async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid Item ID" });
    }

    const deletedItem = await WishlistModel.findByIdAndDelete(req.params.id);

    if (!deletedItem) {
      return res.status(404).json({ message: "Item non trouvé" });
    }

    res.status(200).json({
      success: true,
      message: "Item supprimé avec succès",
    });
  } catch (error) {
    console.error("Erreur lors de la suppression de l'item:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// POST /api/wishlist/:id/toggle-sharing - Basculer le partage
router.post("/:id/toggle-sharing", async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid Item ID" });
    }

    const item = await WishlistModel.findById(req.params.id);

    if (!item) {
      return res.status(404).json({ message: "Item non trouvé" });
    }

    // Inverser le statut de partage
    item.isShared = !item.isShared;
    await item.save();

    res.status(200).json({
      success: true,
      data: item,
      message: item.isShared
        ? "Item partagé avec vos contacts"
        : "Item maintenant privé",
    });
  } catch (error) {
    console.error("Erreur lors du basculement du partage:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// POST /api/wishlist/:id/purchase - Marquer comme acheté
router.post("/:id/purchase", async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid Item ID" });
    }

    const { userId } = req.body; // ID de la personne qui achète

    if (!userId) {
      return res.status(400).json({ message: "userId requis" });
    }

    const item = await WishlistModel.findById(req.params.id);

    if (!item) {
      return res.status(404).json({ message: "Item non trouvé" });
    }

    if (!item.isShared) {
      return res.status(403).json({ message: "Cet item n'est pas partagé" });
    }

    if (item.isPurchased) {
      return res.status(400).json({ message: "Cet item a déjà été acheté" });
    }

    // Marquer comme acheté
    item.isPurchased = true;
    item.purchasedBy = userId;
    item.purchasedAt = new Date();
    await item.save();

    res.status(200).json({
      success: true,
      message: "Item marqué comme acheté",
      data: item,
    });
  } catch (error) {
    console.error("Erreur lors du marquage de l'item:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// POST /api/wishlist/:id/unpurchase - Démarquer comme acheté
router.post("/:id/unpurchase", async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid Item ID" });
    }

    const item = await WishlistModel.findById(req.params.id);

    if (!item) {
      return res.status(404).json({ message: "Item non trouvé" });
    }

    // Démarquer
    item.isPurchased = false;
    item.purchasedBy = null;
    item.purchasedAt = null;
    await item.save();

    res.status(200).json({
      success: true,
      message: "Item démarqué",
      data: item,
    });
  } catch (error) {
    console.error("Erreur lors du démarquage de l'item:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

module.exports = router;
