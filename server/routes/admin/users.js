// routes/admin/users.js
// Gestion des utilisateurs (liste, détail, rôle, suppression douce / restauration)

const express = require("express");
const router = express.Router();

const User = require("../../models/user.model");
const DateModel = require("../../models/date.model");
const Friend = require("../../models/friend.model");
const Event = require("../../models/event.model");
const GiftPoolContribution = require("../../models/giftPoolContribution.model");
const StripeAccount = require("../../models/stripeAccount.model");
const Log = require("../../models/log.model");

// Champs sensibles jamais renvoyés à l'admin (minimisation des données)
const SAFE_FIELDS =
  "-password -resetToken -resetTokenExpires -verificationToken -publicKey -encryptedPrivateKey -oldPublicKey -oldEncryptedPrivateKey -encryptedSeedPhrase";

/*
 * GET /api/admin/users?search=&page=1&limit=25&filter=all|verified|unverified|deleted|admins
 */
router.get("/", async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 25);
    const { search, filter } = req.query;

    const query = {};
    if (search) {
      const rx = new RegExp(String(search).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      query.$or = [{ name: rx }, { surname: rx }, { email: rx }];
    }
    if (filter === "verified") query.isVerified = true;
    if (filter === "unverified") query.isVerified = false;
    if (filter === "deleted") query.deletedAt = { $ne: null };
    if (filter === "admins") query.role = "admin";

    const [users, total] = await Promise.all([
      User.find(query)
        .select(SAFE_FIELDS)
        .sort({ _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      User.countDocuments(query),
    ]);

    res.json({ users, total, page, pages: Math.ceil(total / limit) });
  } catch (error) {
    console.error("❌ Admin users list error:", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

/*
 * GET /api/admin/users/:id — détail + compteurs associés
 */
router.get("/:id", async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select(SAFE_FIELDS);
    if (!user) return res.status(404).json({ message: "Utilisateur introuvable" });

    const [datesCount, friendsCount, eventsOrganized, contributions, stripeAccount, lastLogin] =
      await Promise.all([
        DateModel.countDocuments({ owner: user._id }),
        Friend.countDocuments({
          $or: [{ user: user._id }, { friend: user._id }],
          status: "accepted",
        }),
        Event.countDocuments({ organizer: user._id }),
        GiftPoolContribution.countDocuments({ contributor: user._id }),
        StripeAccount.findOne({ user: user._id }).select(
          "chargesEnabled payoutsEnabled detailsSubmitted onboardingCompletedAt",
        ),
        Log.findOne({ userId: user._id, action: "login" }).sort({ createdAt: -1 }).select("createdAt"),
      ]);

    res.json({
      user,
      counts: { dates: datesCount, friends: friendsCount, eventsOrganized, contributions },
      stripeAccount,
      lastLoginAt: lastLogin?.createdAt || null,
    });
  } catch (error) {
    console.error("❌ Admin user detail error:", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

/*
 * PATCH /api/admin/users/:id/role — { role: "user" | "admin" }
 * Un admin ne peut pas se rétrograder lui-même (évite de se verrouiller dehors).
 */
router.patch("/:id/role", async (req, res) => {
  try {
    const { role } = req.body;
    if (!["user", "admin"].includes(role))
      return res.status(400).json({ message: "Rôle invalide" });
    if (req.params.id === req.payload._id && role !== "admin")
      return res.status(400).json({ message: "Impossible de retirer votre propre rôle admin." });

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { role },
      { new: true },
    ).select(SAFE_FIELDS);
    if (!user) return res.status(404).json({ message: "Utilisateur introuvable" });

    res.json({ message: "Rôle mis à jour", user });
  } catch (error) {
    console.error("❌ Admin role update error:", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

/*
 * DELETE /api/admin/users/:id — suppression douce (deletedAt).
 * Le cron purgeDeletedAccounts fera le ménage définitif.
 */
router.delete("/:id", async (req, res) => {
  try {
    if (req.params.id === req.payload._id)
      return res.status(400).json({ message: "Impossible de supprimer votre propre compte ici." });

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { deletedAt: new Date() },
      { new: true },
    ).select(SAFE_FIELDS);
    if (!user) return res.status(404).json({ message: "Utilisateur introuvable" });

    res.json({ message: "Compte marqué pour suppression", user });
  } catch (error) {
    console.error("❌ Admin user delete error:", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

/*
 * PATCH /api/admin/users/:id/restore — annule la suppression douce
 */
router.patch("/:id/restore", async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { $unset: { deletedAt: 1 } },
      { new: true },
    ).select(SAFE_FIELDS);
    if (!user) return res.status(404).json({ message: "Utilisateur introuvable" });

    res.json({ message: "Compte restauré", user });
  } catch (error) {
    console.error("❌ Admin user restore error:", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

module.exports = router;
