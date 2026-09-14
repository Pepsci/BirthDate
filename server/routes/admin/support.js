// routes/admin/support.js
// Inbox support : liste des tickets, détail, réponse (email ou fil in-app).

const express = require("express");
const router = express.Router();

const SupportMessage = require("../../models/supportMessage.model");
const { notify } = require("../../utils/notify");
const {
  sendSupportReplyEmail,
} = require("../../services/emailTemplates/supportReplyEmail");

/*
 * GET /api/admin/support?status=&page=&limit=
 */
router.get("/", async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 30);
    const { status } = req.query;

    const query = {};
    if (status) query.status = status;

    const [tickets, total, unreadCount] = await Promise.all([
      SupportMessage.find(query)
        .populate("userId", "name surname email")
        // Cagnotte concernée pour un ticket de litige : sans ça, l'admin doit
        // retrouver l'événement à partir d'un message en texte libre.
        .populate("relatedEvent", "shortId title")
        .sort({ lastMessageAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      SupportMessage.countDocuments(query),
      SupportMessage.countDocuments({ unreadAdmin: true }),
    ]);

    res.json({
      tickets,
      total,
      page,
      pages: Math.ceil(total / limit),
      unreadCount,
    });
  } catch (error) {
    console.error("❌ Admin support list error:", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// GET /api/admin/support/:id -> détail d'un ticket, marque comme lu côté admin
router.get("/:id", async (req, res) => {
  try {
    const ticket = await SupportMessage.findById(req.params.id)
      .populate("userId", "name surname email")
      .populate("relatedEvent", "shortId title");
    if (!ticket) {
      return res.status(404).json({ message: "Ticket introuvable" });
    }
    if (ticket.unreadAdmin) {
      ticket.unreadAdmin = false;
      await ticket.save();
    }
    res.json({ ticket });
  } catch (error) {
    console.error("❌ Admin support detail error:", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// POST /api/admin/support/:id/reply -> réponse de l'admin
// - Ticket lié à un compte : message ajouté au fil + notification in-app.
// - Ticket sans compte (formulaire public) : seul canal possible, un vrai
//   email part vers le visiteur et le ticket passe à "closed".
router.post("/:id/reply", async (req, res) => {
  try {
    const { message } = req.body;
    if (!message || !message.trim()) {
      return res.status(400).json({ message: "Le message est requis" });
    }
    const ticket = await SupportMessage.findById(req.params.id);
    if (!ticket) {
      return res.status(404).json({ message: "Ticket introuvable" });
    }

    const body = message.trim();
    ticket.messages.push({
      sender: "admin",
      body,
      adminId: req.payload._id,
    });
    ticket.lastMessageAt = new Date();
    ticket.unreadAdmin = false;

    if (ticket.userId) {
      // Utilisateur connecté : la réponse vit dans son fil, pas besoin
      // d'email — il la voit (et peut y répondre) directement dans l'app.
      ticket.status = "answered";
      ticket.unreadUser = true;
      await ticket.save();

      await notify(req.app, {
        userId: ticket.userId,
        type: "support_reply",
        data: { subject: ticket.subject, ticketId: String(ticket._id) },
        link: `/home?tab=support&ticketId=${ticket._id}`,
      });

      // Le fil vit maintenant dans l'onglet Support du dashboard (pas /contact) :
      // pousser le ticket à jour en direct évite à l'utilisateur de recharger
      // pour voir la réponse — même socket room que les notifications in-app.
      const io = req.app.get("io");
      if (io) {
        io.to(`user:${ticket.userId}`).emit("support:message", { ticket });
      }
    } else {
      // Visiteur sans compte : pas d'espace app où revenir, la réponse part
      // par email. On referme le ticket : ce canal ne boucle pas dans l'app.
      await sendSupportReplyEmail({
        toEmail: ticket.email,
        toName: ticket.name,
        subject: ticket.subject,
        message: body,
      });
      ticket.status = "closed";
      await ticket.save();
    }

    res.json({ success: true, ticket });
  } catch (error) {
    console.error("❌ Admin support reply error:", error);
    res.status(500).json({ message: "Erreur lors de l'envoi de la réponse" });
  }
});

// PATCH /api/admin/support/:id -> changer le statut (fermer / rouvrir)
router.patch("/:id", async (req, res) => {
  try {
    const { status } = req.body;
    if (!["open", "answered", "closed"].includes(status)) {
      return res.status(400).json({ message: "Statut invalide" });
    }
    const ticket = await SupportMessage.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true },
    );
    if (!ticket) {
      return res.status(404).json({ message: "Ticket introuvable" });
    }
    res.json({ ticket });
  } catch (error) {
    console.error("❌ Admin support status error:", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

module.exports = router;
