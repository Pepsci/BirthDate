const express = require("express");
const router = express.Router();
const ogs = require("open-graph-scraper");
const WishlistModel = require("../models/wishlist.model");
const UserModel = require("../models/user.model");
const mongoose = require("mongoose");
const cheerio = require("cheerio");
const axios = require("axios");

// POST /api/wishlist/fetch-url - Récupérer les infos d'un produit depuis une URL
router.post("/fetch-url", async (req, res) => {
  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({ message: "URL requise" });
    }

    // ✅ Détection sites bloqués — VERSION BACKEND
    const blockedDomains = [
      { domain: "amazon", name: "Amazon" },
      { domain: "fnac", name: "Fnac" },
      { domain: "micromania", name: "Micromania" },
    ];

    const matched = blockedDomains.find((site) =>
      url.toLowerCase().includes(site.domain),
    );

    if (matched) {
      return res.status(200).json({
        success: false,
        blocked: true,
        message: `${matched.name} ne supporte pas le remplissage automatique — remplis les champs manuellement`,
        data: null,
      });
    }

    const headers = {
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
      "accept-language": "fr-FR,fr;q=0.9",
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    };

    // Tentative 1 : Open Graph
    try {
      const { result, error } = await ogs({ url, timeout: 5000, headers });

      if (!error && result.ogTitle) {
        const rawPrice = result.ogPriceAmount || null;
        const price = rawPrice ? parseFloat(rawPrice.replace(",", ".")) : null;

        return res.status(200).json({
          success: true,
          data: {
            title: result.ogTitle || result.twitterTitle || null,
            description:
              result.ogDescription || result.twitterDescription || null,
            image:
              result.ogImage?.[0]?.url || result.twitterImage?.[0]?.url || null,
            price: isNaN(price) ? null : price,
            currency: result.ogPriceCurrency || "EUR",
          },
        });
      }
    } catch (ogsError) {
      console.log("OGS échoué, tentative cheerio...");
    }

    // Tentative 2 : Cheerio (Fnac, Amazon, etc.)
    const response = await axios.get(url, { headers, timeout: 8000 });
    const $ = cheerio.load(response.data);

    // Sélecteurs pour les grands sites
    const title =
      $('meta[property="og:title"]').attr("content") ||
      $('meta[name="twitter:title"]').attr("content") ||
      $("h1").first().text().trim() ||
      $("title").text().trim() ||
      null;

    const description =
      $('meta[property="og:description"]').attr("content") ||
      $('meta[name="description"]').attr("content") ||
      null;

    const image =
      $('meta[property="og:image"]').attr("content") ||
      $('meta[name="twitter:image"]').attr("content") ||
      null;

    // Prix : sélecteurs spécifiques Fnac / Amazon
    const rawPrice =
      $('meta[property="product:price:amount"]').attr("content") ||
      $('meta[property="og:price:amount"]').attr("content") ||
      $(".f-priceBox-price").first().text().trim() || // Fnac
      $(".a-price-whole").first().text().trim() || // Amazon
      $('[data-testid="price"]').first().text().trim() ||
      null;

    const cleanPrice = rawPrice
      ? parseFloat(rawPrice.replace(/[^0-9,.]/g, "").replace(",", "."))
      : null;

    if (!title) {
      return res.status(200).json({
        success: false,
        message: "Impossible de récupérer les infos de ce site",
        data: null,
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        title,
        description,
        image,
        price: isNaN(cleanPrice) ? null : cleanPrice,
        currency: "EUR",
      },
    });
  } catch (error) {
    console.error("Erreur fetch-url:", error.message);
    res.status(200).json({
      success: false,
      message: "Erreur lors de la récupération des infos",
      data: null,
    });
  }
});

// POST /api/wishlist/:id/reserve - Réserver un item
router.post("/:id/reserve", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid Item ID" });
    }

    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ message: "userId requis" });
    }

    const item = await WishlistModel.findById(req.params.id);

    if (!item) {
      return res.status(404).json({ message: "Item non trouvé" });
    }

    if (item.reservedBy) {
      return res.status(400).json({ message: "Cet item est déjà réservé" });
    }

    item.reservedBy = userId;
    item.reservedAt = new Date();
    await item.save();

    res.status(200).json({
      success: true,
      message: "Item réservé",
      data: item,
    });
  } catch (error) {
    console.error("Erreur réservation:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// POST /api/wishlist/:id/unreserve - Annuler la réservation
router.post("/:id/unreserve", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid Item ID" });
    }

    const { userId } = req.body;

    const item = await WishlistModel.findById(req.params.id);

    if (!item) {
      return res.status(404).json({ message: "Item non trouvé" });
    }

    // Seul celui qui a réservé peut annuler
    if (item.reservedBy?.toString() !== userId) {
      return res
        .status(403)
        .json({ message: "Vous n'avez pas réservé cet item" });
    }

    item.reservedBy = null;
    item.reservedAt = null;
    await item.save();

    res.status(200).json({
      success: true,
      message: "Réservation annulée",
      data: item,
    });
  } catch (error) {
    console.error("Erreur annulation réservation:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// GET /api/wishlist - Obtenir MA wishlist complète
router.get("/", async (req, res, next) => {
  try {
    const userId = req.query.userId;

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

// GET /api/wishlist/user/:userId - Voir la wishlist d'un ami
router.get("/user/:userId", async (req, res, next) => {
  try {
    const { userId } = req.params;

    if (!mongoose.isValidObjectId(userId)) {
      return res.status(400).json({ message: "Invalid User ID" });
    }

    const targetUser = await UserModel.findById(userId).select(
      "name surname avatar",
    );

    if (!targetUser) {
      return res.status(404).json({ message: "Utilisateur non trouvé" });
    }

    const items = await WishlistModel.find({ userId })
      .populate("purchasedBy", "name surname avatar")
      .populate("reservedBy", "name surname")
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

// POST /api/wishlist - Créer un nouvel item
router.post("/", async (req, res, next) => {
  try {
    const { userId, title, description, price, url, image, isShared } =
      req.body;

    if (!userId || !title) {
      return res.status(400).json({ message: "userId et title requis" });
    }

    const item = await WishlistModel.create({
      userId,
      title,
      description: description || null,
      price,
      url,
      image: image || null,
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

    const { title, description, price, url, image, isShared } = req.body;

    const updatedItem = await WishlistModel.findByIdAndUpdate(
      req.params.id,
      { title, description, price, url, image, isShared },
      { new: true },
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

// ========================================
// Marque l'item comme acheté ET l'ajoute dans les gifts de la date
// ========================================
router.post("/:id/gift-offered", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid Item ID" });
    }

    const { userId, dateId, occasion, year } = req.body;

    if (!userId || !dateId) {
      return res.status(400).json({ message: "userId et dateId requis" });
    }

    if (!mongoose.isValidObjectId(dateId)) {
      return res.status(400).json({ message: "Invalid Date ID" });
    }

    // 1. Récupérer l'item wishlist
    const item = await WishlistModel.findById(req.params.id);
    if (!item) {
      return res.status(404).json({ message: "Item non trouvé" });
    }

    if (item.isPurchased) {
      return res.status(400).json({ message: "Cet item a déjà été acheté" });
    }

    // 2. Marquer l'item comme acheté
    item.isPurchased = true;
    item.purchasedBy = userId;
    item.purchasedAt = new Date();
    // Si l'item était réservé par cet utilisateur, on garde la réservation
    if (!item.reservedBy) {
      item.reservedBy = userId;
      item.reservedAt = new Date();
    }
    await item.save();

    // 3. Ajouter le cadeau dans les gifts de la date
    const dateModel = require("../models/date.model");
    const updatedDate = await dateModel.findOneAndUpdate(
      { _id: dateId, owner: userId },
      {
        $push: {
          gifts: {
            giftName: item.title,
            occasion: occasion || "Anniversaire",
            year: year || new Date().getFullYear(),
            purchased: true,
          },
        },
      },
      { new: true },
    );

    if (!updatedDate) {
      // L'item wishlist a quand même été marqué, on retourne un warning
      return res.status(200).json({
        success: true,
        warning:
          "Item marqué comme acheté mais date introuvable ou non autorisée",
        data: item,
      });
    }

    res.status(200).json({
      success: true,
      message: "Cadeau offert enregistré !",
      wishlistItem: item,
      updatedDate,
    });
  } catch (error) {
    console.error("Erreur gift-offered:", error);
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

    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ message: "userId requis" });
    }

    const item = await WishlistModel.findById(req.params.id);

    if (!item) {
      return res.status(404).json({ message: "Item non trouvé" });
    }

    if (item.isPurchased) {
      return res.status(400).json({ message: "Cet item a déjà été acheté" });
    }

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
