// middleware/isAdmin.js
// À utiliser APRÈS isAuthenticated : vérifie que l'utilisateur a le rôle admin.
// Vérification en base (pas depuis le JWT) → une révocation du rôle est effective immédiatement.

const User = require("../models/user.model");

const isAdmin = async (req, res, next) => {
  try {
    const user = await User.findById(req.payload._id).select("role deletedAt");

    if (!user || user.deletedAt || user.role !== "admin") {
      return res.status(403).json({ message: "Accès réservé aux administrateurs." });
    }

    req.adminUser = user;
    next();
  } catch (error) {
    console.error("❌ isAdmin middleware error:", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
};

module.exports = { isAdmin };
