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
const PoolRestriction = require("../../models/poolRestriction.model");
const OrganizerBankInfo = require("../../models/organizerBankInfo.model");
const { audit } = require("../../services/auditLog");
const { ageFrom } = require("../../utils/age");
const {
  getPoolEligibility,
  activeRestrictionQuery,
} = require("../../services/poolEligibility");

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

    const [
      datesCount,
      friendsCount,
      eventsOrganized,
      contributions,
      stripeAccount,
      lastLogin,
      poolEligibility,
      poolRestrictions,
    ] =
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
        getPoolEligibility(user),
        PoolRestriction.find(activeRestrictionQuery(user._id)).lean(),
      ]);

    res.json({
      user,
      counts: { dates: datesCount, friends: friendsCount, eventsOrganized, contributions },
      stripeAccount,
      lastLoginAt: lastLogin?.createdAt || null,
      age: ageFrom(user.birthDate),
      pool: { ...poolEligibility, restrictions: poolRestrictions },
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

/*
 * POST /api/admin/users/:id/pool-block — { reason }
 *
 * Bloque l'accès aux cagnottes d'un utilisateur (typiquement : mineur signalé
 * qui a modifié sa date de naissance). En une fois :
 *   - pose une restriction "admin_block" sans échéance ;
 *   - gèle toutes ses cagnottes Stripe ouvertes (plus aucun paiement possible) ;
 *   - coupe RIB, PayPal et cagnotte externe sur ses événements, et supprime
 *     les RIB chiffrés.
 * Les sommes déjà versées restent sur son compte Stripe : le remboursement se
 * fait depuis l'onglet Cagnottes. Motif obligatoire, comme pour un gel.
 */
router.post("/:id/pool-block", async (req, res) => {
  try {
    const reason = String(req.body.reason || "").trim();
    if (reason.length < 10) {
      return res.status(400).json({
        code: "REASON_REQUIRED",
        message: "Un motif d'au moins 10 caractères est obligatoire.",
      });
    }

    const user = await User.findById(req.params.id).select("_id email");
    if (!user) return res.status(404).json({ message: "Utilisateur introuvable" });

    await PoolRestriction.create({
      user: user._id,
      kind: "admin_block",
      until: null,
      reason,
      createdBy: req.payload._id,
    });

    // Tout ce qui collecte de l'argent sur ses événements
    const events = await Event.find({
      organizer: user._id,
      $or: [
        { "giftPool.active": true },
        { "directTransfer.ibanEnabled": true },
        { "directTransfer.paypalEnabled": true },
        { "directTransfer.externalPoolEnabled": true },
      ],
    });

    const io = req.app.get("io");
    let frozenPools = 0;
    for (const event of events) {
      if (event.giftPool?.active) {
        event.giftPool.active = false;
        event.giftPoolEnabled = false;
        frozenPools++;
        await audit(req, {
          action: "pool_freeze",
          userId: req.payload._id,
          metadata: {
            scope: "admin_user_block",
            eventId: String(event._id),
            eventShortId: event.shortId,
            organizerId: String(user._id),
            reason,
          },
        });
      }
      if (event.directTransfer) {
        event.directTransfer.ibanEnabled = false;
        event.directTransfer.paypalEnabled = false;
        event.directTransfer.externalPoolEnabled = false;
      }
      await event.save();
      io?.to(`event:${event.shortId}`).emit("event:pool_update", { shortId: event.shortId });
      io?.to(`event:${event.shortId}`).emit("event:transfer_update", { shortId: event.shortId });
    }
    if (events.length > 0) {
      await OrganizerBankInfo.deleteMany({ event: { $in: events.map((e) => e._id) } });
    }

    await audit(req, {
      action: "pool_user_block",
      userId: req.payload._id,
      metadata: {
        targetUserId: String(user._id),
        reason,
        eventsAffected: events.map((e) => e.shortId),
        frozenPools,
      },
    });

    res.json({
      message: `Cagnottes bloquées. ${frozenPools} cagnotte(s) gelée(s), ${events.length} événement(s) concerné(s).`,
      frozenPools,
      eventsAffected: events.length,
    });
  } catch (error) {
    console.error("❌ Admin pool block error:", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

/*
 * DELETE /api/admin/users/:id/pool-block
 * Lève TOUTES les restrictions actives (blocage admin ET délai de 30 jours
 * après changement de date de naissance, par ex. après vérification d'une
 * pièce d'identité). Ne rouvre aucune cagnotte : l'organisateur le fera.
 */
router.delete("/:id/pool-block", async (req, res) => {
  try {
    const result = await PoolRestriction.updateMany(
      activeRestrictionQuery(req.params.id),
      { $set: { liftedAt: new Date(), liftedBy: req.payload._id } },
    );
    if (result.modifiedCount > 0) {
      await audit(req, {
        action: "pool_user_unblock",
        userId: req.payload._id,
        metadata: { targetUserId: String(req.params.id), lifted: result.modifiedCount },
      });
    }
    res.json({ message: "Restriction levée", lifted: result.modifiedCount });
  } catch (error) {
    console.error("❌ Admin pool unblock error:", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

module.exports = router;
