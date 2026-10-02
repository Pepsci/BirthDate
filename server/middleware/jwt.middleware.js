// middleware/jwt.middleware.js
//
// Protège une route : exige une session ACTIVE et pose `req.payload`
// (`req.payload._id` = identifiant de l'utilisateur connecté).
//
// La validation complète (signature, compte existant et non supprimé, token
// postérieur au dernier changement de mot de passe) est dans utils/session.js.
// Le token est lu dans l'en-tête `Authorization: Bearer` (app mobile) ou dans
// le cookie httpOnly `authToken` (site web).

const { resolveSession } = require("../utils/session");

const isAuthenticated = async (req, res, next) => {
  try {
    const payload = await resolveSession(req);
    if (!payload) {
      return res.status(401).json({
        code: "UNAUTHENTICATED",
        message: "Session expirée. Reconnectez-vous.",
      });
    }
    req.payload = payload;
    next();
  } catch (error) {
    next(error);
  }
};

module.exports = {
  isAuthenticated,
};
