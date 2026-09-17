/**
 * presence.js — Qui est connecté, depuis quel client, et avec quel jeton push.
 *
 * `connectedUsers` (partagée via app.get("connectedUsers")) est une
 *   Map<userId, Map<socketId, { kind: "web" | "app", pushToken: string|null }>>
 *
 * ── Pourquoi pas simplement userId → socketId ───────────────────────────────
 * Un même compte a souvent plusieurs sockets : un onglet web + l'app iPhone +
 * l'app Android (+ un simulateur oublié…). Avec un seul socketId par compte :
 *   1. un onglet web ouvert faisait croire l'utilisateur « en ligne » et
 *      bloquait TOUTES les push mobiles de messages privés ;
 *   2. la déconnexion d'un appareil effaçait l'entrée alors qu'un autre
 *      restait connecté.
 *
 * ── Raisonner par APPAREIL, pas par type ────────────────────────────────────
 * Une app mobile ouverte ne doit couper la push que pour ELLE-MÊME. L'app
 * envoie donc son jeton Expo dans le handshake (`auth.pushToken`, ou plus
 * tard via l'événement `presence:pushToken`) et pushService saute uniquement
 * ces jetons-là. Les autres téléphones du compte sonnent normalement.
 *
 * Un socket "app" SANS jeton (ancien build, ou jeton pas encore obtenu) ne
 * coupe rien : mieux vaut une notification en double qu'un message perdu.
 *
 * L'app mobile coupe son socket dès le passage en arrière-plan
 * (mobile/src/lib/socket.ts) : un socket "app" = app au premier plan.
 */

const MAX_TOKEN_LENGTH = 200;

/** N'accepte qu'un jeton Expo plausible — la valeur vient du client. */
function sanitizePushToken(value) {
  if (typeof value !== "string" || value.length > MAX_TOKEN_LENGTH) return null;
  return /^Expo(nent)?PushToken\[[^\]]+\]$/.test(value) ? value : null;
}

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
  const kind = clientKindOf(socket);
  sockets.set(socket.id, {
    kind,
    pushToken:
      kind === "app" ? sanitizePushToken(socket.handshake?.auth?.pushToken) : null,
  });
  return firstSocket;
}

/** Associe (ou met à jour) le jeton push d'un socket déjà enregistré. */
function setSocketPushToken(connectedUsers, socket, value) {
  const entry = connectedUsers.get(String(socket.userId))?.get(socket.id);
  if (!entry || entry.kind !== "app") return;
  entry.pushToken = sanitizePushToken(value);
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
  for (const entry of sockets.values()) if (entry.kind === kind) return true;
  return false;
}

/** Jetons push des appareils mobiles actuellement au premier plan. */
function openAppPushTokens(connectedUsers, userId) {
  const tokens = [];
  const sockets = connectedUsers.get(String(userId));
  if (!sockets) return tokens;
  for (const entry of sockets.values()) {
    if (entry.kind === "app" && entry.pushToken) tokens.push(entry.pushToken);
  }
  return tokens;
}

/** Tous les socketIds du compte. */
function socketIdsOf(connectedUsers, userId) {
  return Array.from(connectedUsers.get(String(userId))?.keys() || []);
}

module.exports = {
  addSocket,
  setSocketPushToken,
  removeSocket,
  isOnline,
  hasClient,
  openAppPushTokens,
  socketIdsOf,
};
