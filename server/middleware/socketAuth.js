const jwt = require("jsonwebtoken");

module.exports = (socket, next) => {
  try {
    // Le token peut être envoyé soit dans auth.token soit dans handshake.headers
    const token =
      socket.handshake.auth.token ||
      (socket.handshake.headers.authorization &&
        socket.handshake.headers.authorization.split(" ")[1]);

    if (!token) {
      console.warn("⚠️ Socket.io: Aucun token fourni");
      return next(new Error("Authentication error: No token provided"));
    }

    // Vérifier et décoder le token
    const decoded = jwt.verify(token, process.env.TOKEN_SECRET);

    // Attacher l'userId au socket pour l'utiliser dans les handlers
    socket.userId = decoded._id; // Adapte selon la structure de ton token

    console.log(`✅ Socket.io: User ${socket.userId} authenticated`);
    next();
  } catch (error) {
    console.error("❌ Socket.io Authentication error:", error.message);
    next(new Error("Authentication error: Invalid token"));
  }
};
