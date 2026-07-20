const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const SharedGiftList = require("../models/sharedGiftList.model");
const SharedGiftListInvitation = require("../models/sharedGiftListInvitation.model");
const DateModel = require("../models/date.model");
const User = require("../models/user.model");
const { isAuthenticated } = require("../middleware/jwt.middleware");
const { notify } = require("../utils/notify");

const personLabel = (dateDoc) =>
  `${dateDoc?.name || ""} ${dateDoc?.surname || ""}`.trim() || "quelqu'un";

// ── Inviter un ami à créer une liste commune ────────────────────────────────
router.post("/invite", isAuthenticated, async (req, res) => {
  try {
    const { friendId, dateId, mode, giftIds } = req.body;
    if (!mongoose.isValidObjectId(friendId) || !mongoose.isValidObjectId(dateId))
      return res.status(400).json({ message: "Paramètres invalides" });
    if (friendId === req.payload._id)
      return res.status(400).json({ message: "Choisis un autre membre" });

    const date = await DateModel.findOne({
      _id: dateId,
      owner: req.payload._id,
    });
    if (!date) return res.status(404).json({ message: "Carte introuvable" });

    // Mode de partage : "full" (défaut) ou "selective" avec une liste d'idées
    const shareMode = mode === "selective" ? "selective" : "full";
    const validGiftIds =
      shareMode === "selective" && Array.isArray(giftIds)
        ? giftIds.filter((id) => mongoose.isValidObjectId(id))
        : [];
    if (shareMode === "selective" && validGiftIds.length === 0)
      return res
        .status(400)
        .json({ message: "Sélectionne au moins une idée à partager." });

    // Évite les doublons d'invitation en attente
    const existing = await SharedGiftListInvitation.findOne({
      fromUser: req.payload._id,
      toUser: friendId,
      fromDate: dateId,
      status: "pending",
    });
    if (existing)
      return res.status(200).json({ invitation: existing, already: true });

    const inv = await SharedGiftListInvitation.create({
      fromUser: req.payload._id,
      toUser: friendId,
      fromDate: dateId,
      sharedGiftList: date.sharedGiftList || null,
      label: personLabel(date),
      shareMode,
      giftIds: validGiftIds,
    });

    const me = await User.findById(req.payload._id).select("name surname");
    await notify(req.app, {
      userId: friendId,
      type: "shared_gift_invite",
      data: {
        fromName: `${me?.name || ""} ${me?.surname || ""}`.trim(),
        personName: personLabel(date),
        invitationId: inv._id.toString(),
      },
      link: `/shared-invites`,
    });

    res.status(201).json({ invitation: inv });
  } catch (err) {
    console.error("❌ shared invite:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// ── Mes invitations reçues (pending) ────────────────────────────────────────
router.get("/invitations", isAuthenticated, async (req, res) => {
  try {
    const invs = await SharedGiftListInvitation.find({
      toUser: req.payload._id,
      status: "pending",
    })
      .populate("fromUser", "name surname avatar")
      .populate("fromDate", "name surname")
      .sort({ createdAt: -1 });
    res.json(invs);
  } catch (err) {
    console.error("❌ shared invitations:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// ── Mes invitations envoyées (pending), optionnellement pour une carte ──────
router.get("/sent", isAuthenticated, async (req, res) => {
  try {
    const query = { fromUser: req.payload._id, status: "pending" };
    if (req.query.dateId && mongoose.isValidObjectId(req.query.dateId)) {
      query.fromDate = req.query.dateId;
    }
    const invs = await SharedGiftListInvitation.find(query)
      .populate("toUser", "name surname avatar")
      .populate("fromDate", "name surname")
      .sort({ createdAt: -1 });
    res.json(invs);
  } catch (err) {
    console.error("❌ shared sent:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// ── Annuler une invitation que J'AI envoyée ─────────────────────────────────
router.post("/invitations/:id/cancel", isAuthenticated, async (req, res) => {
  try {
    const inv = await SharedGiftListInvitation.findById(req.params.id);
    if (!inv || inv.fromUser.toString() !== req.payload._id)
      return res.status(404).json({ message: "Invitation introuvable" });
    if (inv.status !== "pending")
      return res.status(400).json({ message: "Invitation déjà traitée" });
    await inv.deleteOne();
    res.json({ success: true });
  } catch (err) {
    console.error("❌ shared cancel:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// ── Accepter une invitation (en choisissant sa carte) ───────────────────────
router.post("/invitations/:id/accept", isAuthenticated, async (req, res) => {
  try {
    const { dateId } = req.body;
    const inv = await SharedGiftListInvitation.findById(req.params.id);
    if (!inv || inv.toUser.toString() !== req.payload._id)
      return res.status(404).json({ message: "Invitation introuvable" });
    if (inv.status !== "pending")
      return res.status(400).json({ message: "Invitation déjà traitée" });

    const myDate = await DateModel.findOne({
      _id: dateId,
      owner: req.payload._id,
    });
    if (!myDate) return res.status(404).json({ message: "Carte introuvable" });

    const fromDate = await DateModel.findById(inv.fromDate);
    if (!fromDate)
      return res.status(404).json({ message: "Carte initiatrice introuvable" });

    // Récupère ou crée la liste commune
    let list = null;
    const existingListId = inv.sharedGiftList || fromDate.sharedGiftList;
    if (existingListId) list = await SharedGiftList.findById(existingListId);
    if (!list) {
      // Idées à partager depuis la carte initiatrice, selon le mode choisi
      const sourceGifts = fromDate.gifts || [];
      let seed = sourceGifts;
      if (inv.shareMode === "selective" && (inv.giftIds?.length ?? 0) > 0) {
        const idSet = new Set(inv.giftIds.map((id) => id.toString()));
        seed = sourceGifts.filter((g) => idSet.has(g._id.toString()));
      }
      const seededGifts = seed.map((g) => ({
        giftName: g.giftName,
        occasion: g.occasion,
        year: g.year,
        url: g.url ?? null,
        price: g.price ?? null,
        image: g.image ?? null,
        status: g.status ?? "to_buy",
        purchased: g.purchased ?? false,
        addedBy: inv.fromUser,
      }));

      list = await SharedGiftList.create({
        members: [inv.fromUser],
        createdBy: inv.fromUser,
        label: inv.label,
        gifts: seededGifts,
      });
    }

    // Ajoute les deux membres
    const addMember = (uid) => {
      if (!list.members.some((m) => m.toString() === uid.toString()))
        list.members.push(uid);
    };
    addMember(inv.fromUser);
    addMember(req.payload._id);
    await list.save();

    // Relie les deux cartes à la liste
    fromDate.sharedGiftList = list._id;
    await fromDate.save();
    myDate.sharedGiftList = list._id;
    await myDate.save();

    inv.status = "accepted";
    inv.sharedGiftList = list._id;
    await inv.save();

    const me = await User.findById(req.payload._id).select("name surname");
    await notify(req.app, {
      userId: inv.fromUser,
      type: "shared_gift_accepted",
      data: {
        fromName: `${me?.name || ""} ${me?.surname || ""}`.trim(),
        personName: inv.label,
        listId: list._id.toString(),
      },
      link: `/home?tab=date&dateId=${inv.fromDate}`,
    });

    res.json({ sharedGiftList: list._id });
  } catch (err) {
    console.error("❌ shared accept:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// ── Refuser une invitation ──────────────────────────────────────────────────
router.post("/invitations/:id/decline", isAuthenticated, async (req, res) => {
  try {
    const inv = await SharedGiftListInvitation.findById(req.params.id);
    if (!inv || inv.toUser.toString() !== req.payload._id)
      return res.status(404).json({ message: "Invitation introuvable" });
    inv.status = "declined";
    await inv.save();
    res.json({ success: true });
  } catch (err) {
    console.error("❌ shared decline:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// ── Middleware : liste + vérif membre ───────────────────────────────────────
async function loadListAsMember(req, res, next) {
  if (!mongoose.isValidObjectId(req.params.id))
    return res.status(400).json({ message: "ID invalide" });
  const list = await SharedGiftList.findById(req.params.id);
  if (!list) return res.status(404).json({ message: "Liste introuvable" });
  if (!list.members.some((m) => m.toString() === req.payload._id))
    return res.status(403).json({ message: "Non autorisé" });
  req.sharedList = list;
  next();
}

// ── Détail liste (gifts + membres) ──────────────────────────────────────────
router.get("/:id", isAuthenticated, loadListAsMember, async (req, res) => {
  try {
    const list = await SharedGiftList.findById(req.params.id)
      .populate("members", "name surname avatar")
      .populate("gifts.addedBy", "name surname");
    res.json(list);
  } catch (err) {
    console.error("❌ shared get:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// ── Ajouter un cadeau commun ────────────────────────────────────────────────
router.post("/:id/gifts", isAuthenticated, loadListAsMember, async (req, res) => {
  try {
    const { giftName, occasion, year, url, price, image, status } = req.body;
    if (!giftName || !giftName.trim())
      return res.status(400).json({ message: "Nom requis" });
    req.sharedList.gifts.push({
      giftName: giftName.trim(),
      occasion: occasion || "Anniversaire",
      year: year || new Date().getFullYear(),
      status: status || "to_buy",
      purchased: status ? status !== "to_buy" : false,
      url: url || null,
      price: price ?? null,
      image: image || null,
      addedBy: req.payload._id,
    });
    await req.sharedList.save();
    res.status(201).json(req.sharedList);
  } catch (err) {
    console.error("❌ shared add gift:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// ── Modifier un cadeau commun ───────────────────────────────────────────────
router.patch(
  "/:id/gifts/:giftId",
  isAuthenticated,
  loadListAsMember,
  async (req, res) => {
    try {
      const gift = req.sharedList.gifts.id(req.params.giftId);
      if (!gift) return res.status(404).json({ message: "Cadeau introuvable" });
      const { giftName, occasion, year, url, price, image, status } = req.body;
      if (giftName !== undefined) gift.giftName = giftName;
      if (occasion !== undefined) gift.occasion = occasion;
      if (year !== undefined) gift.year = year;
      if (url !== undefined) gift.url = url || null;
      if (price !== undefined) gift.price = price ? Number(price) : null;
      if (image !== undefined) gift.image = image || null;
      if (status !== undefined) {
        gift.status = status;
        gift.purchased = status !== "to_buy";
      }
      await req.sharedList.save();
      res.json(req.sharedList);
    } catch (err) {
      console.error("❌ shared update gift:", err);
      res.status(500).json({ message: "Erreur serveur" });
    }
  },
);

// ── Supprimer un cadeau commun ──────────────────────────────────────────────
router.delete(
  "/:id/gifts/:giftId",
  isAuthenticated,
  loadListAsMember,
  async (req, res) => {
    try {
      const gift = req.sharedList.gifts.id(req.params.giftId);
      if (!gift) return res.status(404).json({ message: "Cadeau introuvable" });
      // Mongoose 6 : les sous-documents n'ont pas .deleteOne() (ajouté en v7).
      // .pull() retire l'élément du tableau, toutes versions confondues.
      req.sharedList.gifts.pull(req.params.giftId);
      await req.sharedList.save();
      res.json(req.sharedList);
    } catch (err) {
      console.error("❌ shared delete gift:", err);
      res.status(500).json({ message: "Erreur serveur" });
    }
  },
);

// ── Quitter la liste commune ────────────────────────────────────────────────
router.post("/:id/leave", isAuthenticated, loadListAsMember, async (req, res) => {
  try {
    const list = req.sharedList;
    list.members = list.members.filter(
      (m) => m.toString() !== req.payload._id,
    );
    // Détache ma carte
    await DateModel.updateMany(
      { owner: req.payload._id, sharedGiftList: list._id },
      { sharedGiftList: null },
    );
    if (list.members.length === 0) {
      await DateModel.updateMany(
        { sharedGiftList: list._id },
        { sharedGiftList: null },
      );
      await list.deleteOne();
    } else {
      await list.save();
    }
    res.json({ success: true });
  } catch (err) {
    console.error("❌ shared leave:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

module.exports = router;
