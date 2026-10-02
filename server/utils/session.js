// utils/session.js
//
// Point unique de validation d'une session.
//
// Un JWT valide ne suffit plus : la signature prouve seulement que le token a
// été émis un jour. On vérifie en plus, EN BASE et à chaque requête, que le
// compte existe encore, qu'il n'est pas supprimé (suppression par
// l'utilisateur ou par un admin — c'est aussi le « bannissement »), et que le
// token n'est pas antérieur au dernier changement de mot de passe.
//
// Sans cela, un compte supprimé ou banni gardait l'accès jusqu'à l'expiration
// de son token (30 jours, renouvelés par /auth/verify), et changer son mot de
// passe ne déconnectait aucun autre appareil.
//
// Tout ce qui authentifie passe par ici : le middleware `isAuthenticated`, le
// socket (`middleware/socketAuth.js`) et les routes à authentification
// facultative (page événement, cagnotte, rejoindre avec un code).

const jwt = require("jsonwebtoken");
const User = require("../models/user.model");

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Instant à écrire dans `User.passwordChangedAt`.
 * Arrondi à la seconde inférieure : `iat` d'un JWT est en secondes, et le
 * token réémis juste après le changement doit rester valide.
 */
function sessionCutoff() {
  return new Date(Math.floor(Date.now() / 1000) * 1000);
}

/** Renvoie le payload si le token correspond à une session active, sinon null. */
async function verifySessionToken(token) {
  if (!token || typeof token !== "string") return null;
  let payload;
  try {
    payload = jwt.verify(token, process.env.TOKEN_SECRET, {
      algorithms: ["HS256"],
    });
  } catch {
    return null;
  }
  if (!payload?._id) return null;

  let user;
  try {
    user = await User.findById(payload._id)
      .select("deletedAt passwordChangedAt")
      .lean();
  } catch {
    return null; // identifiant malformé
  }
  if (!user || user.deletedAt) return null;
  if (
    user.passwordChangedAt &&
    payload.iat * 1000 < new Date(user.passwordChangedAt).getTime()
  ) {
    return null;
  }
  return payload;
}

/** Tokens présentés par une requête HTTP : en-tête Bearer, puis cookie. */
function tokensFromRequest(req) {
  const tokens = [];
  const header = req.headers?.authorization;
  if (header) {
    const [scheme, value] = header.split(" ");
    if (scheme === "Bearer" && value) tokens.push(value);
  }
  if (req.cookies?.authToken) tokens.push(req.cookies.authToken);
  return tokens;
}

/**
 * Session de la requête, ou null.
 *
 * On essaie chaque token présenté et on garde le premier valable : l'app
 * mobile envoie un Bearer mais conserve aussi le cookie posé à la connexion,
 * qui peut être périmé (après un changement de mot de passe, par exemple).
 */
async function resolveSession(req) {
  for (const token of tokensFromRequest(req)) {
    const payload = await verifySessionToken(token);
    if (payload) return payload;
  }
  return null;
}

/**
 * Remplace le cookie de session du navigateur par un token fraîchement émis.
 * Sans effet pour un client qui n'utilise pas le cookie.
 * @param {"30d"|"8h"} duration durée du token (cf. tokenDurationFrom)
 */
function refreshAuthCookie(req, res, token, duration) {
  if (!req.cookies?.authToken) return;
  res.cookie("authToken", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: duration === "30d" ? 30 * DAY_MS : 8 * 60 * 60 * 1000,
  });
}

/** Coupe immédiatement les connexions temps réel d'un compte (suppression, bannissement). */
function disconnectUserSockets(app, userId) {
  try {
    app?.get("io")?.in(`user:${userId}`).disconnectSockets(true);
  } catch (err) {
    console.error("⚠️ Déconnexion des sockets impossible :", err.message);
  }
}

module.exports = {
  sessionCutoff,
  verifySessionToken,
  resolveSession,
  refreshAuthCookie,
  disconnectUserSockets,
};
