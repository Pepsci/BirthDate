const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const crypto = require("crypto");
const multer = require("multer");
const sharp = require("sharp");

/**
 * Stockage des photos de carte (dates créées manuellement) sur le disque
 * local — même principe que les avatars (config/avatarStorage.js), pas de
 * Cloudinary : le buffer multer n'est jamais écrit tel quel, sharp le
 * re-encode systématiquement en WebP 256×256, et un seul fichier existe par
 * carte (nom déterministe `<dateId>.webp`).
 */

// Dossier de stockage.
//   prod (EC2) : CARD_PHOTO_DIR=/var/www/birthreminder/uploads/card-photos
//   dev        : server/uploads/card-photos
const CARD_PHOTO_DIR =
  process.env.CARD_PHOTO_DIR ||
  path.join(__dirname, "..", "uploads", "card-photos");

// Chemin public (servi par nginx en prod — voir deploy/nginx-card-photos.conf —,
// par express.static en dev / filet de sécurité en prod)
const CARD_PHOTO_PUBLIC_PATH = "/uploads/card-photos";

const PUBLIC_BASE_URL = (
  process.env.BACKEND_URL || "http://localhost:4000"
).replace(/\/+$/, "");

const PHOTO_SIZE = 256;
const WEBP_QUALITY = 80;
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];

fs.mkdirSync(CARD_PHOTO_DIR, { recursive: true });

/** Stockage mémoire uniquement — saveCardPhoto() écrit après authentification. */
const cardPhotoUploader = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      return cb(
        new Error(
          "Type de fichier non autorisé. Formats acceptés : JPG, PNG, WEBP, GIF.",
        ),
        false,
      );
    }
    cb(null, true);
  },
});

/** Nom de fichier déterministe : un dateId ⇒ un seul chemin possible. */
function cardPhotoFilename(dateId) {
  return `${String(dateId)}.webp`;
}

/** Supprime le fichier photo d'une carte (et l'éventuel ancien schéma horodaté). */
async function removeCardPhotoFiles(dateId) {
  const id = String(dateId);
  let entries;
  try {
    entries = await fsp.readdir(CARD_PHOTO_DIR);
  } catch (err) {
    if (err.code === "ENOENT") return 0;
    throw err;
  }

  const targets = entries.filter(
    (f) => f === cardPhotoFilename(id) || f.startsWith(`${id}-`),
  );
  await Promise.all(
    targets.map((f) =>
      fsp.unlink(path.join(CARD_PHOTO_DIR, f)).catch((err) => {
        if (err.code !== "ENOENT") {
          console.error(`⚠️  Suppression photo carte ${f} échouée :`, err.message);
        }
      }),
    ),
  );
  return targets.length;
}

/** Re-encode et enregistre la photo. Retourne l'URL publique absolue. */
async function saveCardPhoto(dateId, buffer) {
  const id = String(dateId);
  const filename = cardPhotoFilename(id);
  const finalPath = path.join(CARD_PHOTO_DIR, filename);

  const output = await sharp(buffer, { animated: false })
    .rotate()
    .resize(PHOTO_SIZE, PHOTO_SIZE, {
      fit: "cover",
      position: sharp.strategy.attention,
    })
    .webp({ quality: WEBP_QUALITY })
    .toBuffer();

  // Écriture atomique : temporaire + rename (voir avatarStorage.js pour le détail).
  const tmpPath = path.join(
    CARD_PHOTO_DIR,
    `.tmp-${id}-${crypto.randomBytes(8).toString("hex")}`,
  );
  try {
    await fsp.writeFile(tmpPath, output);
    await fsp.rename(tmpPath, finalPath);
  } catch (err) {
    await fsp.unlink(tmpPath).catch(() => {});
    throw err;
  }

  const stale = (await fsp.readdir(CARD_PHOTO_DIR)).filter((f) =>
    f.startsWith(`${id}-`),
  );
  await Promise.all(
    stale.map((f) => fsp.unlink(path.join(CARD_PHOTO_DIR, f)).catch(() => {})),
  );

  const version = Date.now();
  return {
    filename,
    bytes: output.length,
    url: `${PUBLIC_BASE_URL}${CARD_PHOTO_PUBLIC_PATH}/${filename}?v=${version}`,
  };
}

module.exports = {
  cardPhotoUploader,
  saveCardPhoto,
  removeCardPhotoFiles,
  CARD_PHOTO_DIR,
  CARD_PHOTO_PUBLIC_PATH,
};
