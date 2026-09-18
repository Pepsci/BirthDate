// utils/unsubscribeLinks.js
//
// Liens de désabonnement « par email » (GET /api/unsubscribe?email=…&type=…).
//
// ⚠️ Ces liens doivent pointer sur le SERVEUR (BACKEND_URL), pas sur le front :
// `${FRONTEND_URL}/api/unsubscribe` tombe sur Vite en dev (aucun proxy /api),
// la requête n'atteint jamais Express et rien n'est écrit en base, alors que
// l'utilisateur croit s'être désabonné.
//
// Le même lien sert aussi d'URL pour l'en-tête List-Unsubscribe (bouton
// « Se désabonner » de Gmail) : Gmail y envoie un POST « one-click », géré par
// POST /api/unsubscribe (routes/unsubscribe.js).

function apiBaseUrl() {
  return (process.env.BACKEND_URL || "http://localhost:4000").replace(/\/+$/, "");
}

/**
 * Construit l'URL de désabonnement.
 * @param {string} email
 * @param {string} type  "chat" | "chat_friend" | "friend_requests" | …
 * @param {object} [extra]  paramètres additionnels (ex. { friendId })
 */
function buildUnsubscribeUrl(email, type, extra = {}) {
  const params = new URLSearchParams({ email, type });
  for (const [key, value] of Object.entries(extra)) {
    if (value !== undefined && value !== null) params.set(key, String(value));
  }
  return `${apiBaseUrl()}/api/unsubscribe?${params.toString()}`;
}

/**
 * En-têtes RFC 8058 pour le bouton « Se désabonner » des webmails.
 * À passer dans `headers` d'un sendMail nodemailer (SendRawEmail).
 * Le SendEmailCommand « simple » de SES v1 ne permet PAS d'en-têtes custom.
 */
function listUnsubscribeHeaders(url) {
  return {
    "List-Unsubscribe": `<${url}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
}

module.exports = { buildUnsubscribeUrl, listUnsubscribeHeaders };
