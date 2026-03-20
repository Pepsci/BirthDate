const Event = require("../models/event.model");
const EventInvitation = require("../models/eventInvitation.model");

const checkEventAccess = async (req, res, next) => {
  try {
    const shortId = req.params.shortId;
    const userId = req.payload._id;

    const event = await Event.findOne({ shortId });
    if (!event) {
      return res.status(404).json({ message: "Événement introuvable" });
    }

    // Is organizer?
    if (event.organizer.toString() === userId) {
      req.event = event;
      req.userRole = "organizer";
      return next();
    }

    // Is invited?
    const invitation = await EventInvitation.findOne({ event: event._id, user: userId });
    if (!invitation) {
      return res.status(403).json({ message: "Action non autorisée. Vous n'êtes pas invité à cet événement." });
    }

    req.event = event;
    req.userRole = "invited";
    req.invitation = invitation;
    return next();
  } catch (err) {
    console.error("❌ checkEventAccess Error:", err);
    res.status(500).json({ message: "Erreur de vérification des droits d'accès à l'événement" });
  }
};

module.exports = { checkEventAccess };
