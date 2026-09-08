/**
 * Refuse toute participation à un événement annulé.
 *
 * ⚠️ À placer APRÈS un middleware qui pose `req.event` (checkGuestOrAuth,
 * checkEventAccess) : il ne charge rien lui-même, pour ne pas relire
 * l'événement une seconde fois à chaque requête.
 *
 * Le problème qu'il règle : après une annulation, l'interface d'un invité qui
 * n'avait pas rechargé la page continuait de proposer les votes, le RSVP et
 * les propositions de cadeaux. Chacune de ces actions notifiait l'organisateur
 * — qui recevait donc « X a voté pour le 12 mars » sur un événement qu'il
 * venait d'annuler. Masquer les boutons côté client ne suffit pas : une page
 * déjà ouverte ne le sait pas, et le serveur doit trancher.
 *
 * Volontairement NON appliqué au chat, au départ d'un événement, à la lecture
 * et à la suppression : après une annulation, les participants ont justement
 * besoin de se parler, et de pouvoir partir ou faire le ménage.
 */
const rejectIfCancelled = (req, res, next) => {
  if (req.event?.status === "cancelled") {
    return res.status(409).json({
      code: "EVENT_CANCELLED",
      message: "Cet événement est annulé : il n'accepte plus de participation.",
    });
  }
  return next();
};

module.exports = { rejectIfCancelled };
