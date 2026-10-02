// middleware/socketAuth.js
//
// Authentification d'une connexion Socket.io. Même règle que les routes HTTP :
// la session doit être active (utils/session.js), pas seulement signée.

const cookie = require("cookie");
const { verifySessionToken } = require("../utils/session");

module.exports = async (socket, next) => {
  try {
    // Le token peut arriver par auth.token, par l'en-tête Authorization ou
    // par le cookie. On les essaie dans cet ordre et on garde le premier
    // valable : le site web garde en mémoire le token reçu au chargement de
    // la page, qui devient périmé après un changement de mot de passe, alors
    // que son cookie, lui, a été renouvelé.
    const candidates = [];
    if (socket.handshake.auth?.token) candidates.push(socket.handshake.auth.token);
    const header = socket.handshake.headers.authorization;
    if (header && header.split(" ")[1]) candidates.push(header.split(" ")[1]);
    if (socket.handshake.headers.cookie) {
      const cookies = cookie.parse(socket.handshake.headers.cookie);
      if (cookies.authToken) candidates.push(cookies.authToken);
    }

    if (candidates.length === 0) {
      return next(new Error("Authentication error: No token provided"));
    }

    for (const token of candidates) {
      const payload = await verifySessionToken(token);
      if (payload) {
        socket.userId = payload._id;
        return next();
      }
    }
    return next(new Error("Authentication error: Invalid token"));
  } catch (error) {
    console.error("❌ Socket.io Authentication error:", error.message);
    next(new Error("Authentication error: Invalid token"));
  }
};
