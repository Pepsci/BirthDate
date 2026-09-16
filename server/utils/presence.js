/**
 * presence.js — Qui est connecté, et depuis quoi.
 *
 * `connectedUsers` (partagée via app.get("connectedUsers")) est une
 *   Map<userId, Map<socketId, "web" | "app">>
 *
 * ── Pourquoi pas simplement userId → socketId ───────────────────────────────
 * Un même compte a souvent plusieurs sockets : un onglet web + l'app iPhone +
 * l'app Android. Avec un seul socketId par utilisateur :
 *   1. un onglet web ouvert faisait croire l'utilisateur « en ligne » et
 *      bloquait TOUTES les push mobiles de messages privés ;
 *   2. la déconnexion d'un appareil effaçait l'entrée alors qu'un autre
 *      restait connecté (et le dernier connecté écrasait les précédents).
 *
 * ── Le type de client ───────────────────────────────────────────────────────
 * Le front web s'annonce avec `auth: { client: "web" }`. Tout le reste
 * (l'app mobile, y compris les anciens builds qui n'envoient rien) compte
 * comme "app". L'app mobile coupe son socket dès le passage en arrière-plan
 * (mobile/src/lib/socket.ts) : un socket "app" = app au premier plan.
 */

const clientKindOf = (socket) =>
  socket.handshake?.auth?.client === "web" ? "web" : "app";

/** Enregistre le socket. Retourne true si c'est le PREMIER socket du compte. */
function addSocket(connectedUsers, socket) {
  const userId = String(socket.userId);
  let sockets = connectedUsers.get(userId);
  const firstSocket = !sockets || sockets.size === 0;
  if (!sockets) {
    sockets = new Map();
    connectedUsers.set(userId, sockets);
  }
  sockets.set(socket.id, clientKindOf(socket));
  return firstSocket;
}

/** Retire le socket. Retourne true si c'était le DERNIER socket du compte. */
function removeSocket(connectedUsers, socket) {
  const userId = String(socket.userId);
  const sockets = connectedUsers.get(userId);
  if (!sockets) return false;
  sockets.delete(socket.id);
  if (sockets.size === 0) {
    connectedUsers.delete(userId);
    return true;
  }
  return false;
}

/** Au moins un socket, tous clients confondus. */
function isOnline(connectedUsers, userId) {
  return (connectedUsers.get(String(userId))?.size || 0) > 0;
}

/** Au moins un socket de ce type ("web" ou "app"). */
function hasClient(connectedUsers, userId, kind) {
  const sockets = connectedUsers.get(String(userId));
  if (!sockets) return false;
  for (const k of sockets.values()) if (k === kind) return true;
  return false;
}

/** Tous les socketIds du compte. */
function socketIdsOf(connectedUsers, userId) {
  return Array.from(connectedUsers.get(String(userId))?.keys() || []);
}

module.exports = { addSocket, removeSocket, isOnline, hasClient, socketIdsOf };
