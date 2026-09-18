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

// ── Où réactiver une notif coupée depuis un email ─────────────────────────────
const REACTIVATE_HINT =
  "Pour la réactiver : Profil → Notifications, sur le site ou dans l'app.";

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Désabonnement identifié par l'email (liens des emails + one-click Gmail).
 * Renvoie le message à afficher ; lève une erreur si rien n'a pu être coupé.
 */
async function unsubscribeByEmail({ email, dateid, type, friendId }) {
  if (!email) throw new Error("Email manquant");

  console.log(
    `🔕 [UNSUBSCRIBE] email=${email} | type=${type || "birthday"} | dateid=${dateid || "-"} | friendId=${friendId || "-"}`,
  );

  const emailFilter = { email: String(email).toLowerCase().trim() };

  // ── 1. Demandes d'ami ──────────────────────────────────────────────────────
  if (type === "friend_requests") {
    const user = await userModel.findOneAndUpdate(
      emailFilter,
      { receiveFriendRequestEmails: false },
      { new: true },
    );
    if (!user) throw new Error("Utilisateur non trouvé");
    console.log(`✅ [UNSUBSCRIBE] friend_requests désactivé pour ${user.email}`);
    return "Vous ne recevrez plus d'emails pour les nouvelles demandes d'ami.";
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
    return "Vous ne recevrez plus d'emails récapitulant vos messages non lus. Le chat et les notifications push ne changent pas.";
  }

  // ── 3. Messages chat — ami spécifique ──────────────────────────────────────
  // Coupe UNIQUEMENT l'email récap des messages non lus venant de cet ami.
  // Ce n'est pas un blocage : il peut toujours écrire, le push et le chat
  // fonctionnent. Réglage = User.chatEmailDisabledFriends, le même que
  // l'interrupteur par ami de Profil → Notifications (web + mobile).
  if (type === "chat_friend") {
    if (!friendId) throw new Error("friendId manquant");

    const user = await userModel.findOneAndUpdate(
      emailFilter,
      { $addToSet: { chatEmailDisabledFriends: friendId } },
      { new: true },
    );
    if (!user) throw new Error("Utilisateur non trouvé");

    const friend = await userModel
      .findById(friendId, "name surname")
      .lean()
      .catch(() => null);
    const friendName = friend
      ? `${friend.name} ${friend.surname || ""}`.trim()
      : "cet ami";

    console.log(
      `✅ [UNSUBSCRIBE] chat_friend ${friendId} désactivé pour ${user.email}`,
    );
    return `Vous ne recevrez plus d'email récapitulatif pour les messages non lus de ${friendName}. Ce n'est pas un blocage : ses messages arrivent toujours dans le chat et en notification push.`;
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
    return `Vous ne recevrez plus de notifications pour l'anniversaire de ${date.name} ${date.surname}.`;
  }

  // ── 5. Tous les anniversaires (défaut) ────────────────────────────────────
  const user = await userModel.findOneAndUpdate(
    emailFilter,
    { receiveBirthdayEmails: false },
    { new: true },
  );
  if (!user) throw new Error("Utilisateur non trouvé");
  console.log(`✅ [UNSUBSCRIBE] birthday désactivé pour ${user.email}`);
  return "Vous avez été désabonné des notifications d'anniversaire.";
}

// ── Route GET /api/unsubscribe ─────────────────────────────────────────────────
// Clic sur un lien « Ne plus recevoir… » dans un email.
router.get("/", async (req, res) => {
  if (!req.query.email) {
    return res
      .status(400)
      .send(errorPage("Email manquant. Impossible de traiter votre demande."));
  }
  try {
    const message = await unsubscribeByEmail(req.query);
    return res.send(
      successPage(`${escapeHtml(message)}<br><br>${escapeHtml(REACTIVATE_HINT)}`),
    );
  } catch (error) {
    console.error("❌ [UNSUBSCRIBE] Erreur:", error.message);
    return res
      .status(500)
      .send(errorPage(`Une erreur est survenue : ${escapeHtml(error.message)}`));
  }
});

/*
 * POST /api/unsubscribe  — désabonnement par identifiant utilisateur
 *
 * ⚠️ Cette route manquait, et TOUS les liens « se désabonner » des emails
 * étaient donc cassés. Le parcours réel est le suivant : l'email pointe vers
 * la page front /unsubscribe?userId=…&type=…, qui appelle en POST /unsubscribe
 * avec { userId, dateId, type }. Or seule une route GET lisant `req.query.email`
 * existait : la page recevait un 404, et l'utilisateur un message d'erreur.
 *
 * Le GET par email est conservé tel quel juste au-dessus : les emails de
 * demande d'ami l'utilisent encore, et d'anciens messages déjà partis dans les
 * boîtes de réception continuent de pointer dessus.
 *
 * Aucune authentification : c'est délibéré et nécessaire — on se désabonne
 * depuis sa boîte mail, sans se connecter. L'identifiant Mongo joue le rôle de
 * jeton opaque, et l'action est strictement restrictive (elle ne peut que
 * couper des envois), donc sans risque d'usage abusif.
 */
router.post("/", async (req, res) => {
  // ── One-click (RFC 8058) : bouton « Se désabonner » de Gmail / Apple Mail ──
  // Le webmail POSTe sur l'URL de l'en-tête List-Unsubscribe, avec le corps
  // `List-Unsubscribe=One-Click` (form-urlencoded). Les paramètres utiles sont
  // donc dans la query string, pas dans le corps. Le webmail n'affiche pas la
  // réponse : un 200 vide suffit.
  const isOneClick =
    (req.body && req.body["List-Unsubscribe"] === "One-Click") ||
    (!req.body?.userId && req.query.email);
  if (isOneClick) {
    try {
      await unsubscribeByEmail(req.query);
      return res.status(200).send("OK");
    } catch (error) {
      console.error("❌ [UNSUBSCRIBE ONE-CLICK] Erreur:", error.message);
      return res.status(400).send("Désabonnement impossible");
    }
  }

  try {
    const { userId, dateId, type } = req.body || {};

    if (!userId) {
      return res.status(400).json({ message: "userId manquant" });
    }

    console.log(
      `🔕 [UNSUBSCRIBE] userId=${userId} | type=${type || "all_birthdays"} | dateId=${dateId || "-"}`,
    );

    // Anniversaire précis : c'est la date qui porte le réglage, pas le user.
    if (type === "specific" && dateId) {
      const date = await dateModel.findOneAndUpdate(
        { _id: dateId, owner: userId },
        { receiveNotifications: false },
        { new: true },
      );
      if (!date) {
        return res.status(404).json({ message: "Anniversaire non trouvé" });
      }
      return res.json({
        message: `Vous ne recevrez plus de rappels pour ${date.name} ${date.surname}.`,
      });
    }

    // Champ du modèle User à passer à false selon le type demandé.
    const FIELD_BY_TYPE = {
      monthlyRecap: "monthlyRecap",
      namedays: "receiveNamedayEmails",
      friend_requests: "receiveFriendRequestEmails",
      chat: "receiveChatEmails",
      all: "receiveBirthdayEmails",
      all_birthdays: "receiveBirthdayEmails",
    };
    const field = FIELD_BY_TYPE[type] || "receiveBirthdayEmails";

    const user = await userModel.findByIdAndUpdate(
      userId,
      { [field]: false },
      { new: true },
    );
    if (!user) {
      return res.status(404).json({ message: "Utilisateur non trouvé" });
    }

    console.log(`✅ [UNSUBSCRIBE] ${field}=false pour ${user.email}`);

    const MESSAGE_BY_FIELD = {
      monthlyRecap: "Vous ne recevrez plus le récap mensuel.",
      receiveNamedayEmails: "Vous ne recevrez plus les rappels de fêtes.",
      receiveFriendRequestEmails:
        "Vous ne recevrez plus d'emails pour les demandes d'ami.",
      receiveChatEmails:
        "Vous ne recevrez plus d'emails pour les messages du chat.",
      receiveBirthdayEmails:
        "Vous ne recevrez plus les rappels d'anniversaire.",
    };
    return res.json({ message: MESSAGE_BY_FIELD[field] });
  } catch (error) {
    console.error("❌ [UNSUBSCRIBE POST] Erreur:", error.message);
    return res.status(500).json({ message: "Erreur serveur" });
  }
});

module.exports = router;
