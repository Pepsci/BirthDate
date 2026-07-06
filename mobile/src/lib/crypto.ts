/**
 * crypto.ts — Portage mobile de front/src/utils/encryption.js
 *
 * Même schéma que le web :
 *   - Paire de clés NaCl box (X25519 + XSalsa20-Poly1305)
 *   - Clé privée chiffrée par une clé dérivée du mot de passe (scrypt, sel = userId)
 *   - Messages : box(message, nonce, publicKey destinataire, ma clé privée)
 *   - Format : base64(nonce(24) ‖ ciphertext)
 *
 * Règles absolues (identiques au web) :
 *   - La clé privée NE QUITTE JAMAIS l'appareil (stockée en Keychain/Keystore)
 *   - Un nonce aléatoire unique par message
 */

import nacl from "tweetnacl";
import { scrypt } from "@noble/hashes/scrypt.js";
import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";

// ── PRNG : tweetnacl a besoin d'une source d'aléa — expo-crypto la fournit ──
nacl.setPRNG((x: Uint8Array, n: number) => {
  const bytes = Crypto.getRandomBytes(n);
  x.set(bytes);
});

// ── Helpers base64 / UTF-8 (pur JS, indépendant de atob/btoa) ────────────────

const B64_CHARS =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

export function encodeBase64(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i];
    const b1 = i + 1 < bytes.length ? bytes[i + 1] : NaN;
    const b2 = i + 2 < bytes.length ? bytes[i + 2] : NaN;
    out += B64_CHARS[b0 >> 2];
    out += B64_CHARS[((b0 & 3) << 4) | (isNaN(b1) ? 0 : b1 >> 4)];
    out += isNaN(b1) ? "=" : B64_CHARS[((b1 & 15) << 2) | (isNaN(b2) ? 0 : b2 >> 6)];
    out += isNaN(b2) ? "=" : B64_CHARS[b2 & 63];
  }
  return out;
}

export function decodeBase64(b64: string): Uint8Array {
  const clean = b64.replace(/[^A-Za-z0-9+/]/g, "");
  const len = Math.floor((clean.length * 3) / 4);
  const bytes = new Uint8Array(len);
  let p = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const c0 = B64_CHARS.indexOf(clean[i]);
    const c1 = B64_CHARS.indexOf(clean[i + 1]);
    const c2 = B64_CHARS.indexOf(clean[i + 2]);
    const c3 = B64_CHARS.indexOf(clean[i + 3]);
    bytes[p++] = (c0 << 2) | (c1 >> 4);
    if (c2 >= 0) bytes[p++] = ((c1 & 15) << 4) | (c2 >> 2);
    if (c3 >= 0) bytes[p++] = ((c2 & 3) << 6) | c3;
  }
  return bytes.slice(0, p);
}

function utf8ToBytes(str: string): Uint8Array {
  // TextEncoder est disponible sous Hermes (RN >= 0.74)
  return new TextEncoder().encode(str);
}

function bytesToUtf8(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

// ── Stockage de la clé privée (Keychain iOS / Keystore Android) ─────────────

const PRIVATE_KEY_STORE = "e2ePrivateKey";

export async function storePrivateKey(privateKeyBytes: Uint8Array): Promise<void> {
  await SecureStore.setItemAsync(PRIVATE_KEY_STORE, encodeBase64(privateKeyBytes));
}

export async function getPrivateKey(): Promise<Uint8Array | null> {
  const b64 = await SecureStore.getItemAsync(PRIVATE_KEY_STORE);
  return b64 ? decodeBase64(b64) : null;
}

export async function clearPrivateKey(): Promise<void> {
  await SecureStore.deleteItemAsync(PRIVATE_KEY_STORE);
}

// ── Génération de paire de clés ──────────────────────────────────────────────

export function generateKeyPair(): { publicKey: string; secretKey: Uint8Array } {
  const keyPair = nacl.box.keyPair();
  return {
    publicKey: encodeBase64(keyPair.publicKey),
    secretKey: keyPair.secretKey,
  };
}

// ── Dérivation scrypt (mêmes paramètres que le web) ──────────────────────────

const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1, dkLen: 32 };

function deriveEncryptionKey(password: string, userId: string): Uint8Array {
  return scrypt(password, userId, SCRYPT_PARAMS);
}

// ── Chiffrement / déchiffrement de la clé privée (secretbox) ─────────────────

export function encryptPrivateKey(
  privateKeyBytes: Uint8Array,
  password: string,
  userId: string,
): string {
  const key = deriveEncryptionKey(password, userId);
  const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);
  const encrypted = nacl.secretbox(privateKeyBytes, nonce, key);
  const combined = new Uint8Array(nonce.length + encrypted.length);
  combined.set(nonce);
  combined.set(encrypted, nonce.length);
  return encodeBase64(combined);
}

export function decryptPrivateKey(
  encryptedB64: string,
  password: string,
  userId: string,
): Uint8Array | null {
  try {
    const key = deriveEncryptionKey(password, userId);
    const combined = decodeBase64(encryptedB64);
    const nonce = combined.slice(0, nacl.secretbox.nonceLength);
    const ciphertext = combined.slice(nacl.secretbox.nonceLength);
    return nacl.secretbox.open(ciphertext, nonce, key);
  } catch {
    return null;
  }
}

// ── Chiffrement / déchiffrement de messages (box asymétrique) ────────────────

export function encryptMessage(
  message: string,
  recipientPublicKeyB64: string,
  myPrivateKey: Uint8Array,
): string {
  const recipientPublicKey = decodeBase64(recipientPublicKeyB64);
  const nonce = nacl.randomBytes(nacl.box.nonceLength);
  const encrypted = nacl.box(
    utf8ToBytes(message),
    nonce,
    recipientPublicKey,
    myPrivateKey,
  );
  const combined = new Uint8Array(nonce.length + encrypted.length);
  combined.set(nonce);
  combined.set(encrypted, nonce.length);
  return encodeBase64(combined);
}

export function decryptMessage(
  encryptedB64: string,
  senderPublicKeyB64: string,
  privateKey: Uint8Array,
): string | null {
  try {
    const senderPublicKey = decodeBase64(senderPublicKeyB64);
    const combined = decodeBase64(encryptedB64);
    const nonce = combined.slice(0, nacl.box.nonceLength);
    const ciphertext = combined.slice(nacl.box.nonceLength);
    const decrypted = nacl.box.open(ciphertext, nonce, senderPublicKey, privateKey);
    return decrypted ? bytesToUtf8(decrypted) : null;
  } catch {
    return null;
  }
}

// ── Setup des clés au login (miroir de setupE2EKeys du web) ──────────────────

import { api } from "./api";

export async function setupE2EKeys(
  password: string,
  user: { _id: string; publicKey?: string | null; encryptedPrivateKey?: string | null },
): Promise<void> {
  const userId = user._id.toString();

  console.log(
    `🔐 setupE2EKeys: publicKey=${!!user.publicKey} encryptedPrivateKey=${!!user.encryptedPrivateKey}`,
  );
  // Cas 1 : pas encore de clés (première connexion / après reset mdp)
  if (!user.publicKey || !user.encryptedPrivateKey) {
    const { publicKey, secretKey } = generateKeyPair();
    const encKey = encryptPrivateKey(secretKey, password, userId);
    await api("/users/keys", {
      method: "PUT",
      body: JSON.stringify({ publicKey, encryptedPrivateKey: encKey }),
    });
    await storePrivateKey(secretKey);
    console.log("🔐 E2E: nouvelle paire générée et stockée");
    return;
  }

  // Cas 2 : connexion normale — déchiffrer la clé existante
  const privateKey = decryptPrivateKey(user.encryptedPrivateKey, password, userId);
  if (privateKey) {
    await storePrivateKey(privateKey);
    console.log("🔐 E2E: clé privée déchiffrée et stockée ✅");
    return;
  }

  // Cas 3 : échec de déchiffrement — on N'ÉCRASE PAS les clés du compte
  // (le web régénère silencieusement, mais depuis le mobile on préfère ne pas
  // invalider les messages existants ; le chat retombera en clair)
  console.warn("⚠️ E2E: impossible de déchiffrer la clé privée — chat en clair");
  await clearPrivateKey();
}
