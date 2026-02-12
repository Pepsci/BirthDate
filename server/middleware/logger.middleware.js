const Log = require("../models/log.model");

const logAction = (action) => {
  return async (req, res, next) => {
    try {
      // Récupère l'IP réelle (même derrière un proxy/load balancer)
      const ipAddress =
        req.headers["x-forwarded-for"]?.split(",")[0].trim() ||
        req.headers["x-real-ip"] ||
        req.connection.remoteAddress ||
        req.socket.remoteAddress;

      const userAgent = req.headers["user-agent"];

      // Log seulement si utilisateur authentifié
      if (req.payload?._id) {
        await Log.create({
          userId: req.payload._id,
          action,
          ipAddress,
          userAgent,
          metadata: {
            url: req.originalUrl,
            method: req.method,
          },
        });
      }

      next();
    } catch (error) {
      console.error("Erreur logging:", error);
      // Continue même si le log échoue (ne pas bloquer l'utilisateur)
      next();
    }
  };
};

module.exports = { logAction };
