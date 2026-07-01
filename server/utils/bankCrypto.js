const crypto = require("crypto");

const ALGO = "aes-256-gcm";

// Clé de 32 octets dérivée de l'env (64 caractères hex)
function getKey() {
  const hex = process.env.BANK_ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error(
      "BANK_ENCRYPTION_KEY manquante ou invalide (64 caractères hex attendus)",
    );
  }
  return Buffer.from(hex, "hex");
}

/**
 * Chiffre une chaîne (ex: IBAN).
 * Retourne les 3 morceaux nécessaires au déchiffrement.
 * - iv : vecteur d'initialisation, UNIQUE par chiffrement (jamais réutilisé)
 * - authTag : signature GCM qui détecte toute altération du chiffré
 */
function encrypt(plainText) {
  const iv = crypto.randomBytes(12); // 96 bits, recommandé pour GCM
  const cipher = crypto.createCipheriv(ALGO, getKey(), iv); // ⚠️ voir note ci-dessous
  let encrypted = cipher.update(plainText, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");
  return {
    encrypted,
    iv: iv.toString("hex"),
    authTag,
  };
}

/**
 * Déchiffre. Lève une erreur si le authTag ne correspond pas
 * (donnée corrompue ou altérée) → on ne renvoie jamais un IBAN douteux.
 */
function decrypt({ encrypted, iv, authTag }) {
  const decipher = crypto.createDecipheriv(
    ALGO,
    getKey(),
    Buffer.from(iv, "hex"),
  );
  decipher.setAuthTag(Buffer.from(authTag, "hex"));
  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

module.exports = { encrypt, decrypt };
