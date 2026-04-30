const jwt = require("jsonwebtoken");
const Event = require("../models/event.model");
const EventInvitation = require("../models/eventInvitation.model");

const checkGuestOrAuth = async (req, res, next) => {
  try {
    const shortId = req.params.shortId;
    const event = await Event.findOne({ shortId });
    if (!event)
      return res.status(404).json({ message: "Événement introuvable" });

    req.event = event;

    // --- Tentative 1 : JWT ---
    let userId = null;
    const cookieToken = req.cookies?.authToken;
    const bearerToken = req.headers.authorization?.split(" ")[1];
    const rawToken = cookieToken || bearerToken;

    if (rawToken) {
      try {
        const payload = jwt.verify(rawToken, process.env.TOKEN_SECRET);
        userId = payload._id;
      } catch (_) {}
    }

    if (userId) {
      req.payload = { _id: userId }; // ← permet req.payload._id dans les routes

      if (event.organizer.toString() === userId) {
        req.userRole = "organizer";
        return next();
      }
      const invitation = await EventInvitation.findOne({
        event: event._id,
        user: userId,
      });
      if (invitation) {
        req.userRole = "invited";
        req.invitation = invitation;
        return next();
      }
      return res
        .status(403)
        .json({ message: "Vous n'êtes pas invité à cet événement." });
    }

    // --- Tentative 2 : guestToken ---
    const guestToken = req.headers["x-guest-token"];
    if (guestToken) {
      const invitation = await EventInvitation.findOne({
        event: event._id,
        guestToken,
        user: null,
      });
      if (!invitation) {
        return res
          .status(403)
          .json({ message: "Token invité invalide ou expiré." });
      }
      req.userRole = "guest";
      req.invitation = invitation;
      req.guestName = invitation.guestName;
      return next();
    }

    return res.status(401).json({ message: "Authentification requise." });
  } catch (err) {
    console.error("❌ checkGuestOrAuth Error:", err);
    res.status(500).json({ message: "Erreur de vérification d'accès." });
  }
};

module.exports = { checkGuestOrAuth };
