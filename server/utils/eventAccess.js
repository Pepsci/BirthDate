// utils/eventAccess.js
//
// Deux garde-fous partagés par les routes et les sockets d'événement.
//
// 1. userCanAccessEvent : un compte n'a accès à un événement que s'il en est
//    l'organisateur ou s'il y est invité. Connaître le lien ne suffit pas.
// 2. publicInvitation : ce qu'on renvoie d'une invitation à un client.
//    - `guestToken` est le SECRET qui identifie un invité sans compte : il ne
//      sort jamais dans une liste (l'invité reçoit le sien à la réponse de
//      /join, et nulle part ailleurs).
//    - `externalEmail` n'est visible que par l'organisateur.

const EventInvitation = require("../models/eventInvitation.model");

async function userCanAccessEvent(event, userId) {
  if (!event || !userId) return false;
  const organizerId = String(event.organizer?._id || event.organizer);
  if (organizerId === String(userId)) return true;
  const invitation = await EventInvitation.exists({
    event: event._id,
    user: userId,
  });
  return !!invitation;
}

function publicInvitation(invitation, viewerIsOrganizer) {
  const inv =
    invitation && typeof invitation.toObject === "function"
      ? invitation.toObject()
      : { ...invitation };
  delete inv.guestToken;
  if (!viewerIsOrganizer) delete inv.externalEmail;
  return inv;
}

module.exports = { userCanAccessEvent, publicInvitation };
