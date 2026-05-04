// ============================================================
// server/routes/wishlist.public.js
// Routes publiques wishlist — sans authentification
// ============================================================

const router = require("express").Router();
const UserModel = require("../models/user.model");
const WishlistModel = require("../models/wishlist.model");

// ─── GET /api/wishlist/public/:slug ──────────────────────────
// Retourne les items isShared:true — aucune info personnelle
router.get("/:slug", async (req, res) => {
  try {
    const user = await UserModel.findOne({
      wishlistPublicSlug: req.params.slug,
      wishlistPublic: true,
    });

    if (!user) {
      return res.status(404).json({ message: "Liste introuvable" });
    }

    const items = await WishlistModel.find({
      userId: user._id,
      isShared: true,
    }).select(
      "title price url image description isPurchased reservedBy reservedByGuest",
    );

    const sanitizedItems = items.map((item) => ({
      _id: item._id,
      title: item.title,
      price: item.price,
      url: item.url,
      image: item.image,
      description: item.description,
      isPurchased: item.isPurchased,
      isReserved: !!item.reservedBy || !!item.reservedByGuest,
    }));

    res.json({
      items: sanitizedItems,
      hasFriendCode: !!user.wishlistFriendCode,
    });
  } catch (err) {
    console.error("[wishlist.public] GET error:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// ─── POST /api/wishlist/public/:slug/verify ──────────────────
router.post("/:slug/verify", async (req, res) => {
  try {
    const { friendCode } = req.body;

    const user = await UserModel.findOne({
      wishlistPublicSlug: req.params.slug,
      wishlistPublic: true,
    });

    if (!user) {
      return res.status(404).json({ message: "Liste introuvable" });
    }

    if (!user.wishlistFriendCode) {
      return res.json({ valid: true });
    }

    if (
      !friendCode ||
      friendCode.toUpperCase() !== user.wishlistFriendCode.toUpperCase()
    ) {
      return res.status(401).json({ message: "Code incorrect" });
    }

    res.json({ valid: true });
  } catch (err) {
    console.error("[wishlist.public] verify error:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// ─── POST /api/wishlist/public/:slug/:itemId/reserve ─────────
router.post("/:slug/:itemId/reserve", async (req, res) => {
  try {
    const { friendCode, guestName } = req.body;

    const user = await UserModel.findOne({
      wishlistPublicSlug: req.params.slug,
      wishlistPublic: true,
    });

    if (!user) {
      return res.status(404).json({ message: "Liste introuvable" });
    }

    if (user.wishlistFriendCode) {
      if (
        !friendCode ||
        friendCode.toUpperCase() !== user.wishlistFriendCode.toUpperCase()
      ) {
        return res.status(401).json({ message: "Code incorrect" });
      }
    }

    const item = await WishlistModel.findOne({
      _id: req.params.itemId,
      userId: user._id,
      isShared: true,
    });

    if (!item) {
      return res.status(404).json({ message: "Item introuvable" });
    }

    if (item.reservedBy || item.reservedByGuest || item.isPurchased) {
      return res.status(409).json({ message: "Déjà réservé" });
    }

    item.reservedByGuest = guestName || "Un ami";
    item.reservedAt = new Date();
    await item.save();

    res.json({ success: true, message: "Réservé avec succès !" });
  } catch (err) {
    console.error("[wishlist.public] reserve error:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// ─── POST /api/wishlist/public/:slug/:itemId/unreserve ───────
router.post("/:slug/:itemId/unreserve", async (req, res) => {
  try {
    const { friendCode } = req.body;

    const user = await UserModel.findOne({
      wishlistPublicSlug: req.params.slug,
      wishlistPublic: true,
    });

    if (!user) {
      return res.status(404).json({ message: "Liste introuvable" });
    }

    if (user.wishlistFriendCode) {
      if (
        !friendCode ||
        friendCode.toUpperCase() !== user.wishlistFriendCode.toUpperCase()
      ) {
        return res.status(401).json({ message: "Code incorrect" });
      }
    }

    const item = await WishlistModel.findOne({
      _id: req.params.itemId,
      userId: user._id,
      isShared: true,
    });

    if (!item) {
      return res.status(404).json({ message: "Item introuvable" });
    }

    if (item.isPurchased) {
      return res.status(409).json({ message: "Article déjà acheté" });
    }

    item.reservedByGuest = null;
    item.reservedAt = null;
    await item.save();

    res.json({ success: true, message: "Réservation annulée" });
  } catch (err) {
    console.error("[wishlist.public] unreserve error:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

module.exports = router;
