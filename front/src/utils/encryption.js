/**
 * encryption.js — Fonctions cryptographiques E2E de BirthReminder
 *
 * Librairies :
 *   tweetnacl       — chiffrement asymétrique (box) + symétrique (secretbox)
 *   tweetnacl-util  — encodage base64 / UTF-8
 *   @noble/hashes   — dérivation de clé scrypt (password → 32 bytes)
 *   bip39           — génération / validation de seed phrase 12 mots
 *
 * Règles absolues :
 *   - La clé privée NE QUITTE JAMAIS le client (jamais envoyée en HTTP)
 *   - sessionStorage uniquement pour la clé en mémoire (jamais localStorage)
 *   - Un nonce aléatoire unique est généré pour chaque message chiffré
 */

import nacl from "tweetnacl";
import { encodeBase64 } from "tweetnacl-util";
import * as bip39 from "bip39";
import { scrypt } from "@noble/hashes/scrypt.js";

// ────────────────────────────────────────────────────────────────────────────
// Helpers natifs — contournent complètement les polyfills Vite
// qui font retourner des Buffer au lieu de vrais Uint8Array natifs
// ────────────────────────────────────────────────────────────────────────────

/** base64 string → Uint8Array natif garanti (via atob, jamais tweetnacl-util) */
function toUint8Array(value) {
  if (value instanceof Uint8Array) return value;
  if (typeof value === "string") {
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }
  // Buffer ou ArrayBuffer
  return new Uint8Array(value.buffer || value);
}

/** string UTF-8 → Uint8Array natif (TextEncoder, standard browser API) */
function utf8ToBytes(str) {
  return new TextEncoder().encode(str);
}

/** Uint8Array → string UTF-8 (TextDecoder, standard browser API) */
function bytesToUtf8(bytes) {
  return new TextDecoder().decode(bytes);
}

// ────────────────────────────────────────────────────────────────────────────
// SessionStorage — clé privée déchiffrée en mémoire
// ────────────────────────────────────────────────────────────────────────────

const SESSION_KEY = "e2e_private_key";

/**
 * Stocke la clé privée brute (Uint8Array) en sessionStorage sous forme base64.
 * Vidé automatiquement à la fermeture de l'onglet.
 */
export function storePrivateKey(privateKeyBytes) {
  sessionStorage.setItem(SESSION_KEY, encodeBase64(privateKeyBytes));
}

/**
 * Récupère la clé privée depuis sessionStorage.
 * @returns {Uint8Array|null} clé privée de 32 bytes, ou null si absente
 */
export function getPrivateKey() {
  const b64 = sessionStorage.getItem(SESSION_KEY);
  return b64 ? toUint8Array(b64) : null;
}

/** Vide la clé privée de sessionStorage (appelé à la déconnexion). */
export function clearPrivateKey() {
  sessionStorage.removeItem(SESSION_KEY);
}

/** Indique si une clé privée est disponible dans la session courante. */
export function hasPrivateKey() {
  return !!sessionStorage.getItem(SESSION_KEY);
}

// ────────────────────────────────────────────────────────────────────────────
// Génération de paire de clés NaCl (Curve25519 / X25519)
// ────────────────────────────────────────────────────────────────────────────

/**
 * Génère une nouvelle paire de clés NaCl aléatoire.
 *
 * @returns {{
 *   publicKey: string,    — clé publique encodée base64 (à stocker en DB)
 *   secretKey: Uint8Array — clé privée brute 32 bytes (ne quitte pas le client)
 * }}
 */
export function generateKeyPair() {
  const keyPair = nacl.box.keyPair();
  return {
    publicKey: encodeBase64(keyPair.publicKey),
    secretKey: keyPair.secretKey,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Dérivation de clé depuis le mot de passe (scrypt)
// ────────────────────────────────────────────────────────────────────────────

// Paramètres scrypt : N=16384 (2^14), r=8, p=1 → ~100ms en browser
// dkLen=32 bytes pour une clé NaCl secretbox
const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1, dkLen: 32 };

/**
 * Dérive une clé de 32 bytes depuis un mot de passe et un sel (userId).
 * Résultat déterministe : même password + userId → même clé.
 * @private
 */
function deriveEncryptionKey(password, userId) {
  return scrypt(password, userId, SCRYPT_PARAMS);
}

// ────────────────────────────────────────────────────────────────────────────
// Chiffrement / déchiffrement de la clé privée (secretbox symétrique)
// ────────────────────────────────────────────────────────────────────────────

/**
 * Chiffre la clé privée avec le mot de passe de l'utilisateur.
 * Valable pour les deux modes (Standard et Full E2E).
 *
 * Format de sortie (base64) : nonce(24 bytes) ‖ ciphertext
 *
 * @param {Uint8Array} privateKeyBytes — clé privée brute 32 bytes
 * @param {string}     password         — mot de passe en clair
 * @param {string}     userId           — MongoDB ObjectId (sel scrypt)
 * @returns {string}   encryptedPrivateKey encodée base64
 */
export function encryptPrivateKey(privateKeyBytes, password, userId) {
  const key = deriveEncryptionKey(password, userId);
  const nonce = nacl.randomBytes(nacl.secretbox.nonceLength); // 24 bytes
  const encrypted = nacl.secretbox(privateKeyBytes, nonce, key);

  // Stockage unifié : nonce + ciphertext concaténés
  const combined = new Uint8Array(nonce.length + encrypted.length);
  combined.set(nonce);
  combined.set(encrypted, nonce.length);
  return encodeBase64(combined);
}

/**
 * Déchiffre la clé privée avec le mot de passe.
 *
 * @param {string} encryptedB64 — valeur stockée en DB (nonce ‖ ciphertext, base64)
 * @param {string} password
 * @param {string} userId
 * @returns {Uint8Array|null} clé privée brute, ou null si mot de passe incorrect
 */
export function decryptPrivateKey(encryptedB64, password, userId) {
  try {
    const key = deriveEncryptionKey(password, userId);
    const combined = toUint8Array(encryptedB64);
    const nonce = combined.slice(0, nacl.secretbox.nonceLength);
    const ciphertext = combined.slice(nacl.secretbox.nonceLength);
    return nacl.secretbox.open(ciphertext, nonce, key); // Uint8Array | null
  } catch {
    return null;
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Chiffrement / déchiffrement de messages 1-1 (box asymétrique)
// ────────────────────────────────────────────────────────────────────────────

/**
 * Chiffre un message pour un destinataire (DH Curve25519 + XSalsa20-Poly1305).
 *
 * Format de sortie (base64) : nonce(24 bytes) ‖ ciphertext
 *
 * @param {string}     message               — texte en clair
 * @param {string}     recipientPublicKeyB64  — publicKey du destinataire (base64)
 * @param {Uint8Array} myPrivateKey           — ma clé privée (via getPrivateKey())
 * @returns {string}   contenu chiffré encodé base64
 */
export function encryptMessage(message, recipientPublicKeyB64, myPrivateKey) {
  const recipientPublicKey = toUint8Array(recipientPublicKeyB64);
  const privateKey = toUint8Array(myPrivateKey);
  const nonce = nacl.randomBytes(nacl.box.nonceLength); // 24 bytes, unique par message
  const encrypted = nacl.box(
    utf8ToBytes(message),
    nonce,
    recipientPublicKey,
    privateKey,
  );

  const combined = new Uint8Array(nonce.length + encrypted.length);
  combined.set(nonce);
  combined.set(encrypted, nonce.length);
  return encodeBase64(combined);
}

/**
 * Déchiffre un message reçu.
 *
 * @param {string}     encryptedB64        — contenu chiffré en base64
 * @param {string}     senderPublicKeyB64  — publicKey de l'expéditeur (base64)
 * @param {Uint8Array} myPrivateKey        — ma clé privée (via getPrivateKey())
 * @returns {string|null} texte déchiffré, ou null si déchiffrement impossible
 *   (clé absente, message corrompu, expéditeur non E2E, etc.)
 */
export function decryptMessage(encryptedB64, senderPublicKeyB64, myPrivateKey) {
  try {
    const senderPublicKey = toUint8Array(senderPublicKeyB64);
    const privateKey = toUint8Array(myPrivateKey);
    const combined = toUint8Array(encryptedB64);
    const nonce = combined.slice(0, nacl.box.nonceLength);
    const ciphertext = combined.slice(nacl.box.nonceLength);
    const decrypted = nacl.box.open(
      ciphertext,
      nonce,
      senderPublicKey,
      privateKey,
    );
    return decrypted ? bytesToUtf8(decrypted) : null;
  } catch {
    return null;
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Seed phrase BIP39 — Mode Full E2E
// ────────────────────────────────────────────────────────────────────────────

/**
 * Génère une phrase de récupération de 12 mots (128 bits d'entropie).
 * @returns {string} phrase BIP39 (mots séparés par des espaces)
 */
export function generateSeedPhrase() {
  return bip39.generateMnemonic(); // 128 bits → 12 mots
}

/**
 * Valide une phrase BIP39 (checksum + wordlist).
 * @param {string} seedPhrase
 * @returns {boolean}
 */
export function validateSeedPhrase(seedPhrase) {
  return bip39.validateMnemonic(seedPhrase.trim().toLowerCase());
}

/**
 * Dérive une clé privée NaCl depuis une seed phrase BIP39.
 *
 * Méthode : PBKDF2-SHA512 (bip39 standard) → Buffer 64 bytes → premiers 32 bytes.
 * Résultat déterministe : même seed → même clé privée → même historique de chat.
 *
 * @param {string} seedPhrase — phrase de 12 mots BIP39
 * @returns {Uint8Array} clé privée de 32 bytes (utilisable dans nacl.box)
 * @throws {Error} si la phrase est invalide
 */
export function deriveKeyFromSeed(seedPhrase) {
  if (!validateSeedPhrase(seedPhrase)) {
    throw new Error("Phrase de récupération invalide");
  }
  const seedBuffer = bip39.mnemonicToSeedSync(seedPhrase.trim().toLowerCase());
  // Prend les 32 premiers bytes comme clé privée NaCl
  return new Uint8Array(seedBuffer.buffer, seedBuffer.byteOffset, 32);
}

/**
 * Génère une paire de clés NaCl déterministe depuis une seed phrase.
 * Utilisé pour l'activation du Mode Full E2E.
 *
 * @param {string} seedPhrase — phrase de 12 mots BIP39
 * @returns {{ publicKey: string, secretKey: Uint8Array }}
 */
export function keyPairFromSeed(seedPhrase) {
  const secretKey = deriveKeyFromSeed(seedPhrase);
  const keyPair = nacl.box.keyPair.fromSecretKey(secretKey);
  return {
    publicKey: encodeBase64(keyPair.publicKey),
    secretKey: keyPair.secretKey,
  };
}
