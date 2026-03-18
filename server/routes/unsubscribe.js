// routes/unsubscribe.js

const express = require("express");
const router = express.Router();
const userModel = require("../models/user.model");
const dateModel = require("../models/date.model");

// ── Helpers HTML ──────────────────────────────────────────────────────────────

const styles = `
  body { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 30px; text-align: center; }
  .success { color: #2ecc71; }
  .error { color: #e74c3c; }
  .container { border: 1px solid #ddd; border-radius: 8px; padding: 20px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
  a { color: #3498db; text-decoration: none; }
  a:hover { text-decoration: underline; }
`;

function successPage(message) {
  return `
    <html>
      <head><title>Désabonnement réussi</title><style>${styles}</style></head>
      <body>
        <div class="container">
          <h1>Gestion des notifications</h1>
          <h2 class="success">Succès !</h2>
          <p>${message}</p>
          <p>Vous pouvez gérer toutes vos préférences en
            <a href="${process.env.FRONTEND_URL}/login">vous connectant</a>.
          </p>
        </div>
      </body>
    </html>`;
}

function errorPage(message, status = 404) {
  return `
    <html>
      <head><title>Erreur de désabonnement</title><style>${styles}</style></head>
      <body>
        <div class="container">
          <h1>Gestion des notifications</h1>
          <h2 class="error">Erreur</h2>
          <p>${message}</p>
          <p>Veuillez <a href="${process.env.FRONTEND_URL}/login">vous connecter</a> pour gérer vos préférences.</p>
        </div>
      </body>
    </html>`;
}

// ── Route GET /api/unsubscribe ─────────────────────────────────────────────────
router.get("/", async (req, res) => {
  try {
    const { email, dateid, type, friendId } = req.query;

    if (!email) {
      return res
        .status(400)
        .send(
          errorPage("Email manquant. Impossible de traiter votre demande."),
        );
    }

    console.log(
      `🔕 [UNSUBSCRIBE] email=${email} | type=${type || "birthday"} | dateid=${dateid || "-"} | friendId=${friendId || "-"}`,
    );

    const emailFilter = {
      email: email.toLowerCase().trim(),
    };

    // ── 1. Demandes d'ami ──────────────────────────────────────────────────────
    if (type === "friend_requests") {
      const user = await userModel.findOneAndUpdate(
        emailFilter,
        { receiveFriendRequestEmails: false },
        { new: true },
      );
      if (!user) throw new Error("Utilisateur non trouvé");
      console.log(
        `✅ [UNSUBSCRIBE] friend_requests désactivé pour ${user.email}`,
      );
      return res.send(
        successPage(
          "Vous ne recevrez plus d'emails pour les nouvelles demandes d'ami.",
        ),
      );
    }

    // ── 2. Messages chat — tous ────────────────────────────────────────────────
    if (type === "chat") {
      const user = await userModel.findOneAndUpdate(
        emailFilter,
        { receiveChatEmails: false },
        { new: true },
      );
      if (!user) throw new Error("Utilisateur non trouvé");
      console.log(`✅ [UNSUBSCRIBE] chat désactivé pour ${user.email}`);
      return res.send(
        successPage("Vous ne recevrez plus d'emails pour les messages chat."),
      );
    }

    // ── 3. Messages chat — ami spécifique ──────────────────────────────────────
    if (type === "chat_friend") {
      if (!friendId) throw new Error("friendId manquant");

      const user = await userModel.findOneAndUpdate(
        emailFilter,
        { $addToSet: { chatEmailDisabledFriends: friendId } },
        { new: true },
      );
      if (!user) throw new Error("Utilisateur non trouvé");
      console.log(
        `✅ [UNSUBSCRIBE] chat_friend ${friendId} désactivé pour ${user.email}`,
      );
      return res.send(
        successPage(
          "Vous ne recevrez plus d'emails pour les messages de cet ami.",
        ),
      );
    }

    // ── 4. Anniversaire spécifique ─────────────────────────────────────────────
    if (dateid) {
      const date = await dateModel.findByIdAndUpdate(
        dateid,
        { receiveNotifications: false },
        { new: true },
      );
      if (!date) throw new Error("Anniversaire non trouvé");
      console.log(
        `✅ [UNSUBSCRIBE] anniversaire ${date.name} ${date.surname} désactivé`,
      );
      return res.send(
        successPage(
          `Vous ne recevrez plus de notifications pour l'anniversaire de ${date.name} ${date.surname}.`,
        ),
      );
    }

    // ── 5. Tous les anniversaires (défaut) ────────────────────────────────────
    const user = await userModel.findOneAndUpdate(
      emailFilter,
      { receiveBirthdayEmails: false },
      { new: true },
    );
    if (!user) throw new Error("Utilisateur non trouvé");
    console.log(`✅ [UNSUBSCRIBE] birthday désactivé pour ${user.email}`);
    return res.send(
      successPage("Vous avez été désabonné des notifications d'anniversaire."),
    );
  } catch (error) {
    console.error("❌ [UNSUBSCRIBE] Erreur:", error.message);
    return res
      .status(500)
      .send(errorPage(`Une erreur est survenue : ${error.message}`));
  }
});

module.exports = router;
