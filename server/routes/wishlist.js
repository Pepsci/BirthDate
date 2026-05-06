const express = require("express");
const router = express.Router();
const ogs = require("open-graph-scraper");
const WishlistModel = require("../models/wishlist.model");
const UserModel = require("../models/user.model");
const mongoose = require("mongoose");
const cheerio = require("cheerio");
const axios = require("axios");
const { nanoid } = require("nanoid");
const { isAuthenticated } = require("../middleware/jwt.middleware");
const { notify } = require("../utils/notify");

// ─────────────────────────────────────────────────────────────────────────────
// Tag affilié Amazon
// ─────────────────────────────────────────────────────────────────────────────
const AMAZON_AFFILIATE_TAG = "birthreminder-21";

const AMAZON_DOMAINS = [
  "amazon.fr",
  "amazon.com",
  "amazon.co.uk",
  "amazon.de",
  "amazon.es",
  "amazon.it",
];

function isAmazonUrl(url) {
  try {
    const hostname = new URL(url).hostname.toLowerCase().replace("www.", "");
    return AMAZON_DOMAINS.some(
      (domain) => hostname === domain || hostname.endsWith("." + domain),
    );
  } catch {
    return false;
  }
}

function addAffiliateTag(url) {
  try {
    const parsed = new URL(url);
    // Garder uniquement les paramètres essentiels
    const keepParams = ["dp", "node", "keywords", "th", "psc"];
    const cleanParams = new URLSearchParams();
    for (const [key, value] of parsed.searchParams) {
      if (keepParams.includes(key)) {
        cleanParams.set(key, value);
      }
    }
    cleanParams.set("tag", AMAZON_AFFILIATE_TAG);
    parsed.search = cleanParams.toString();
    return parsed.toString();
  } catch {
    return url;
  }
}

function processUrl(url) {
  if (!url) return url;
  if (isAmazonUrl(url)) return addAffiliateTag(url);
  return url;
}

// ─────────────────────────────────────────────────────────────────────────────
// IMPORTANT : L'ordre des routes est critique.
// Les routes avec chemins fixes DOIVENT être déclarées AVANT /:id
// ─────────────────────────────────────────────────────────────────────────────

// POST /api/wishlist/fetch-url
router.post("/fetch-url", isAuthenticated, async (req, res) => {
  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({ message: "URL requise" });
    }

    // Toujours traiter l'URL pour générer le lien affilié si Amazon
    const affiliateUrl = processUrl(url);

    // Domaines qui bloquent le scraping
    const blockedScraping = [
      { domain: "amazon", name: "Amazon" },
      { domain: "fnac", name: "Fnac" },
      { domain: "micromania", name: "Micromania" },
    ];

    const matchedBlocked = blockedScraping.find((site) =>
      url.toLowerCase().includes(site.domain),
    );

    if (matchedBlocked) {
      return res.status(200).json({
        success: false,
        blocked: true,
        message: `${matchedBlocked.name} ne supporte pas le remplissage automatique — remplis les champs manuellement`,
        data: null,
        affiliateUrl,
      });
    }

    const headers = {
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
      "accept-language": "fr-FR,fr;q=0.9",
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    };

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
          affiliateUrl,
        });
      }
    } catch (ogsError) {
      console.log("OGS échoué, tentative cheerio...");
    }

    const response = await axios.get(url, { headers, timeout: 8000 });
    const $ = cheerio.load(response.data);

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

    const rawPrice =
      $('meta[property="product:price:amount"]').attr("content") ||
      $('meta[property="og:price:amount"]').attr("content") ||
      $(".f-priceBox-price").first().text().trim() ||
      $(".a-price-whole").first().text().trim() ||
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
        affiliateUrl,
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
      affiliateUrl,
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

// ─── Settings partage public ──────────────────────────────────────────────────

// GET /api/wishlist/settings
router.get("/settings", isAuthenticated, async (req, res) => {
  try {
    const user = await UserModel.findById(req.payload._id).select(
      "wishlistPublic wishlistPublicSlug wishlistFriendCode",
    );

    if (!user) {
      return res.status(404).json({ message: "Utilisateur introuvable" });
    }

    res.json({
      isPublic: user.wishlistPublic || false,
      publicSlug: user.wishlistPublicSlug || null,
      friendCode: user.wishlistFriendCode || null,
      publicUrl: user.wishlistPublicSlug
        ? `${process.env.FRONTEND_URL}/wishlist/${user.wishlistPublicSlug}`
        : null,
    });
  } catch (err) {
    console.error("[wishlist] settings error:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// PATCH /api/wishlist/settings/toggle
router.patch("/settings/toggle", isAuthenticated, async (req, res) => {
  try {
    const user = await UserModel.findById(req.payload._id);

    if (!user) {
      return res.status(404).json({ message: "Utilisateur introuvable" });
    }

    if (!user.wishlistPublicSlug) {
      let slug;
      let exists = true;
      while (exists) {
        slug = nanoid(10);
        exists = await UserModel.findOne({ wishlistPublicSlug: slug });
      }
      user.wishlistPublicSlug = slug;
    }

    user.wishlistPublic = !user.wishlistPublic;
    await user.save();

    res.json({
      isPublic: user.wishlistPublic,
      publicSlug: user.wishlistPublicSlug,
      friendCode: user.wishlistFriendCode || null,
      publicUrl: `${process.env.FRONTEND_URL}/wishlist/${user.wishlistPublicSlug}`,
    });
  } catch (err) {
    console.error("[wishlist] toggle error:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// PATCH /api/wishlist/settings/friendcode
router.patch("/settings/friendcode", isAuthenticated, async (req, res) => {
  try {
    const { action } = req.body;
    const user = await UserModel.findById(req.payload._id);

    if (!user) {
      return res.status(404).json({ message: "Utilisateur introuvable" });
    }

    if (action === "remove") {
      user.wishlistFriendCode = null;
    } else {
      user.wishlistFriendCode = Math.random()
        .toString(36)
        .substring(2, 8)
        .toUpperCase();
    }

    await user.save();

    res.json({ friendCode: user.wishlistFriendCode });
  } catch (err) {
    console.error("[wishlist] friendcode error:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// ─── GET /api/wishlist/user/:userId ──────────────────────────────────────────
router.get("/user/:userId", isAuthenticated, async (req, res, next) => {
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

// ─── GET /api/wishlist ────────────────────────────────────────────────────────
router.get("/", isAuthenticated, async (req, res, next) => {
  try {
    const userId = req.payload._id;
    const items = await WishlistModel.find({ userId }).sort({
      isPurchased: 1,
      createdAt: -1,
    });
    res.status(200).json({ success: true, count: items.length, data: items });
  } catch (error) {
    console.error("Erreur lors de la récupération de la wishlist:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// ─── POST /api/wishlist ───────────────────────────────────────────────────────
router.post("/", isAuthenticated, async (req, res, next) => {
  try {
    const { title, description, price, image, isShared } = req.body;
    let { url } = req.body;
    const userId = req.payload._id;

    if (!title) {
      return res.status(400).json({ message: "title requis" });
    }

    // Transformer l'URL en lien affilié si Amazon
    url = processUrl(url);

    const item = await WishlistModel.create({
      userId,
      title,
      description: description || null,
      price,
      url,
      image: image || null,
      isShared: isShared || false,
    });

    res.status(201).json({ success: true, data: item });
  } catch (error) {
    console.error("Erreur lors de la création de l'item:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// ─── Routes avec /:id — toujours EN DERNIER ──────────────────────────────────

// DELETE /api/wishlist/:id/reservation
router.delete("/:id/reservation", isAuthenticated, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid Item ID" });
    }

    const item = await WishlistModel.findOne({
      _id: req.params.id,
      userId: req.payload._id,
    });

    if (!item) {
      return res
        .status(404)
        .json({ message: "Item non trouvé ou non autorisé" });
    }

    if (!item.reservedBy && !item.reservedByGuest) {
      return res.status(400).json({ message: "Cet item n'est pas réservé" });
    }

    item.reservedBy = null;
    item.reservedByGuest = null;
    item.reservedAt = null;
    await item.save();

    res.status(200).json({
      success: true,
      message: "Réservation annulée",
      data: item,
    });
  } catch (error) {
    console.error("Erreur annulation réservation propriétaire:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// POST /api/wishlist/:id/reserve
router.post("/:id/reserve", isAuthenticated, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid Item ID" });
    }

    const reservingUserId = req.payload._id;
    const item = await WishlistModel.findById(req.params.id);

    if (!item) {
      return res.status(404).json({ message: "Item non trouvé" });
    }

    if (item.reservedBy || item.reservedByGuest) {
      return res.status(400).json({ message: "Cet item est déjà réservé" });
    }

    item.reservedBy = reservingUserId;
    item.reservedAt = new Date();
    await item.save();

    if (item.userId.toString() !== reservingUserId.toString()) {
      await notify(req.app, {
        userId: item.userId,
        type: "gift_reserved",
        data: { giftName: item.title },
        link: "/home",
      });
    }

    res
      .status(200)
      .json({ success: true, message: "Item réservé", data: item });
  } catch (error) {
    console.error("Erreur réservation:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// POST /api/wishlist/:id/unreserve
router.post("/:id/unreserve", isAuthenticated, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid Item ID" });
    }

    const item = await WishlistModel.findById(req.params.id);

    if (!item) {
      return res.status(404).json({ message: "Item non trouvé" });
    }

    if (item.reservedBy?.toString() !== req.payload._id) {
      return res
        .status(403)
        .json({ message: "Vous n'avez pas réservé cet item" });
    }

    item.reservedBy = null;
    item.reservedAt = null;
    await item.save();

    res
      .status(200)
      .json({ success: true, message: "Réservation annulée", data: item });
  } catch (error) {
    console.error("Erreur annulation réservation:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// POST /api/wishlist/:id/toggle-sharing
router.post("/:id/toggle-sharing", isAuthenticated, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid Item ID" });
    }

    const item = await WishlistModel.findOne({
      _id: req.params.id,
      userId: req.payload._id,
    });

    if (!item) {
      return res
        .status(404)
        .json({ message: "Item non trouvé ou non autorisé" });
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

// POST /api/wishlist/:id/gift-offered
router.post("/:id/gift-offered", isAuthenticated, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid Item ID" });
    }

    const { dateId, occasion, year } = req.body;
    const userId = req.payload._id;

    if (!dateId) {
      return res.status(400).json({ message: "dateId requis" });
    }

    if (!mongoose.isValidObjectId(dateId)) {
      return res.status(400).json({ message: "Invalid Date ID" });
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
    if (!item.reservedBy) {
      item.reservedBy = userId;
      item.reservedAt = new Date();
    }
    await item.save();

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

// POST /api/wishlist/:id/purchase
router.post("/:id/purchase", isAuthenticated, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid Item ID" });
    }

    const userId = req.payload._id;
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

    res
      .status(200)
      .json({ success: true, message: "Item marqué comme acheté", data: item });
  } catch (error) {
    console.error("Erreur lors du marquage de l'item:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// POST /api/wishlist/:id/unpurchase
router.post("/:id/unpurchase", isAuthenticated, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid Item ID" });
    }

    const item = await WishlistModel.findById(req.params.id);

    if (!item) {
      return res.status(404).json({ message: "Item non trouvé" });
    }

    if (item.purchasedBy?.toString() !== req.payload._id) {
      return res.status(403).json({ message: "Non autorisé" });
    }

    item.isPurchased = false;
    item.purchasedBy = null;
    item.purchasedAt = null;
    await item.save();

    res
      .status(200)
      .json({ success: true, message: "Item démarqué", data: item });
  } catch (error) {
    console.error("Erreur lors du démarquage de l'item:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// GET /api/wishlist/:id
router.get("/:id", isAuthenticated, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid Item ID" });
    }

    const item = await WishlistModel.findById(req.params.id);

    if (!item) {
      return res.status(404).json({ message: "Item non trouvé" });
    }

    res.status(200).json({ success: true, data: item });
  } catch (error) {
    console.error("Erreur lors de la récupération de l'item:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// PATCH /api/wishlist/:id
router.patch("/:id", isAuthenticated, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid Item ID" });
    }

    const { title, description, price, image, isShared } = req.body;
    let { url } = req.body;

    // Transformer l'URL en lien affilié si Amazon
    url = processUrl(url);

    const updatedItem = await WishlistModel.findOneAndUpdate(
      { _id: req.params.id, userId: req.payload._id },
      { title, description, price, url, image, isShared },
      { new: true },
    );

    if (!updatedItem) {
      return res
        .status(404)
        .json({ message: "Item non trouvé ou non autorisé" });
    }

    res.status(200).json({ success: true, data: updatedItem });
  } catch (error) {
    console.error("Erreur lors de la mise à jour de l'item:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// DELETE /api/wishlist/:id
router.delete("/:id", isAuthenticated, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid Item ID" });
    }

    const deletedItem = await WishlistModel.findOneAndDelete({
      _id: req.params.id,
      userId: req.payload._id,
    });

    if (!deletedItem) {
      return res
        .status(404)
        .json({ message: "Item non trouvé ou non autorisé" });
    }

    res
      .status(200)
      .json({ success: true, message: "Item supprimé avec succès" });
  } catch (error) {
    console.error("Erreur lors de la suppression de l'item:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

module.exports = router;
