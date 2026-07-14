// utils/urlGuard.js
// Protection anti-SSRF : empêche le serveur de fetcher des ressources internes
// (localhost, réseau privé, métadonnées cloud 169.254.169.254, etc.).
//
// Deux couches :
//  1. assertSafeUrl(url)  -> valide le schéma + résout le DNS et rejette toute IP privée AVANT le fetch.
//  2. safeHttp(s)Agent    -> agents http/https dont le `lookup` re-valide l'IP à CHAQUE connexion,
//                            y compris lors des redirections (protège contre DNS rebinding & redirect-SSRF).

const dns = require("dns").promises;
const net = require("net");
const http = require("http");
const https = require("https");

// Vérifie si une IP (v4/v6) est privée / réservée / interne
function isPrivateIp(ip) {
  if (!ip) return true;

  // Normaliser les IPv4-mapped IPv6 (ex: ::ffff:169.254.169.254)
  const v4mapped = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  if (v4mapped) ip = v4mapped[1];

  if (net.isIPv4(ip)) {
    const p = ip.split(".").map(Number);
    if (p[0] === 0) return true; // 0.0.0.0/8
    if (p[0] === 10) return true; // 10/8
    if (p[0] === 127) return true; // loopback
    if (p[0] === 169 && p[1] === 254) return true; // link-local / métadonnées cloud
    if (p[0] === 172 && p[1] >= 16 && p[1] <= 31) return true; // 172.16/12
    if (p[0] === 192 && p[1] === 168) return true; // 192.168/16
    if (p[0] === 100 && p[1] >= 64 && p[1] <= 127) return true; // CGNAT 100.64/10
    if (p[0] >= 224) return true; // multicast / réservé
    return false;
  }

  if (net.isIPv6(ip)) {
    const low = ip.toLowerCase();
    if (low === "::1" || low === "::") return true; // loopback / unspecified
    if (low.startsWith("fe80")) return true; // link-local
    if (low.startsWith("fc") || low.startsWith("fd")) return true; // ULA fc00::/7
    return false;
  }

  return true; // format inconnu -> on bloque par défaut
}

// lookup DNS sécurisé pour les agents http/https : rejette toute IP privée
function safeLookup(hostname, options, callback) {
  if (typeof options === "function") {
    callback = options;
    options = {};
  }
  dns
    .lookup(hostname, { all: true })
    .then((addresses) => {
      const list = Array.isArray(addresses) ? addresses : [addresses];
      for (const a of list) {
        if (isPrivateIp(a.address)) {
          return callback(
            new Error(`Résolution interdite (IP interne) pour ${hostname}`),
          );
        }
      }
      const first = list[0];
      callback(null, first.address, first.family);
    })
    .catch((err) => callback(err));
}

const safeHttpAgent = new http.Agent({ lookup: safeLookup });
const safeHttpsAgent = new https.Agent({ lookup: safeLookup });

// Valide le schéma + l'hôte AVANT tout fetch. Lève une erreur si non sûr.
async function assertSafeUrl(raw) {
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error("URL invalide");
  }
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("Seules les URL http(s) sont autorisées");
  }

  const addresses = await dns.lookup(parsed.hostname, { all: true });
  const list = Array.isArray(addresses) ? addresses : [addresses];
  if (list.length === 0) throw new Error("Hôte introuvable");
  for (const a of list) {
    if (isPrivateIp(a.address)) throw new Error("Accès à un hôte interne interdit");
  }
  return parsed;
}

module.exports = { assertSafeUrl, safeHttpAgent, safeHttpsAgent, isPrivateIp };
