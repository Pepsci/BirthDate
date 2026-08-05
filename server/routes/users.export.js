const express = require("express");
const router = express.Router();
const rateLimit = require("express-rate-limit");

const User = require("../models/user.model");
const DateModel = require("../models/date.model");
const Friend = require("../models/friend.model");
const Conversation = require("../models/conversation.model");
const Message = require("../models/message.model");
const Wishlist = require("../models/wishlist.model");
const Event = require("../models/event.model");
const EventInvitation = require("../models/eventInvitation.model");
const Report = require("../models/report.model");
const Log = require("../models/log.model");
const { isAuthenticated } = require("../middleware/jwt.middleware");

/**
 * GET /api/users/me/export — droit d'accès et portabilité (RGPD art. 15 & 20).
 *
 * Deux partis pris :
 *
 * 1. Les messages sont chiffrés de bout en bout : le serveur ne détient que du
 *    texte chiffré et n'a pas la clé. On renvoie donc le chiffré tel quel avec
 *    la copie destinée à l'utilisateur (`encryptedForYou`) ; c'est l'app, qui
 *    détient la clé privée, qui produit l'export lisible.
 *
 * 2. Les conversations « supprimées » ne le sont que pour l'affichage. Elles
 *    figurent donc dans l'export, marquées `hiddenFromYouSince`. Les omettre
 *    reviendrait à déclarer qu'on ne détient pas des données qu'on détient.
 */

// Un export est une requête lourde (agrégation de toutes les collections).
const exportLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Trop de demandes d'export, réessayez dans une heure." },
});

router.get("/me/export", isAuthenticated, exportLimiter, async (req, res) => {
  try {
    const userId = req.payload._id;

    const user = await User.findById(userId)
      .select("-password -resetToken -resetTokenExpires -encryptedPrivateKey")
      .lean();
    if (!user) {
      return res.status(404).json({ message: "Utilisateur introuvable" });
    }

    const [dates, friendships, wishlists, conversations, organizedEvents] =
      await Promise.all([
        DateModel.find({ owner: userId }).lean(),
        Friend.find({ $or: [{ user: userId }, { friend: userId }] })
          .populate("user", "name surname")
          .populate("friend", "name surname")
          .lean(),
        Wishlist.find({ owner: userId }).lean(),
        Conversation.find({ participants: userId })
          .populate("participants", "name surname")
          .lean(),
        Event.find({ organizer: userId }).lean(),
      ]);

    const conversationIds = conversations.map((c) => c._id);

    const [messages, invitations, reports, logs] = await Promise.all([
      // publicKey de l'expéditeur : nécessaire à l'app pour déchiffrer
      // (NaCl box a besoin de la clé publique de l'émetteur).
      Message.find({ conversation: { $in: conversationIds } })
        .populate("sender", "name surname publicKey oldPublicKey")
        .sort({ createdAt: 1 })
        .lean(),
      EventInvitation.find({ user: userId }).populate("event", "title shortId").lean(),
      Report.find({ reporter: userId }).lean(),
      Log.find({ userId }).sort({ createdAt: -1 }).lean(),
    ]);

    // Regroupe les messages par conversation et n'expose à l'utilisateur que
    // SA copie chiffrée — celle du correspondant ne le concerne pas.
    const byConversation = new Map();
    for (const m of messages) {
      const list = byConversation.get(String(m.conversation)) || [];
      list.push({
        _id: m._id,
        sentByYou: String(m.sender?._id ?? m.sender) === String(userId),
        // Repli sur l'empreinte quand le compte de l'expéditeur a été purgé.
        senderName: m.sender
          ? `${m.sender.name} ${m.sender.surname || ""}`.trim()
          : (m.senderSnapshot?.name ?? null),
        senderPublicKey: m.sender?.publicKey ?? m.senderSnapshot?.publicKey ?? null,
        senderOldPublicKey: m.sender?.oldPublicKey ?? null,
        type: m.type,
        isEncrypted: !!m.isEncrypted,
        content: m.content,
        encryptedForYou: m.isEncrypted
          ? (m.encryptedFor && m.encryptedFor[String(userId)]) || null
          : null,
        metadata: m.metadata ?? null,
        edited: !!m.edited,
        createdAt: m.createdAt,
      });
      byConversation.set(String(m.conversation), list);
    }

    const conversationsExport = conversations.map((conv) => {
      const clear = (conv.clears || []).find(
        (c) => String(c.user) === String(userId),
      );
      const other = (conv.participants || []).find(
        (p) => String(p._id) !== String(userId),
      );
      return {
        _id: conv._id,
        with: other ? `${other.name} ${other.surname || ""}`.trim() : null,
        createdAt: conv.createdAt,
        lastMessageAt: conv.lastMessageAt,
        // Conversation retirée de votre liste à cette date : les messages
        // antérieurs ne vous sont plus affichés, mais ils existent toujours —
        // votre correspondant en garde une copie.
        hiddenFromYouSince: clear ? clear.at : null,
        messages: byConversation.get(String(conv._id)) || [],
      };
    });

    res.setHeader(
      "Content-Disposition",
      `attachment; filename="birthreminder-donnees-${userId}.json"`,
    );
    res.json({
      exportedAt: new Date(),
      about:
        "Export de vos données personnelles (RGPD art. 15 et 20). Les messages chiffrés de bout en bout apparaissent chiffrés : seul votre appareil possède la clé permettant de les lire.",
      profil: user,
      dates,
      amis: friendships,
      wishlists,
      conversations: conversationsExport,
      evenementsOrganises: organizedEvents,
      invitationsRecues: invitations,
      signalementsEmis: reports,
      journalDActivite: logs,
    });
  } catch (error) {
    console.error("❌ Erreur export RGPD:", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

module.exports = router;
