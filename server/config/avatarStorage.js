const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const crypto = require("crypto");
const multer = require("multer");
const sharp = require("sharp");

/**
 * Stockage des avatars sur le disque local (remplace Cloudinary).
 *
 * Principe :
 *  - multer garde le fichier en mémoire (jamais écrit tel quel sur le disque)
 *  - sharp le re-encode systématiquement en WebP 256×256 (~15 Ko)
 *  - un seul fichier par utilisateur : tout avatar précédent est supprimé
 *
 * Le re-encodage côté serveur est ce qui garantit la taille finale : un client
 * modifié qui contourne le redimensionnement mobile/web ne peut pas faire
 * grossir le stockage, puisque le buffer reçu n'est jamais conservé.
 */

// Dossier de stockage.
//   prod (EC2) : AVATAR_DIR=/var/www/birthreminder/uploads/avatars
//   dev        : server/uploads/avatars
// Ce dossier doit vivre HORS du dépôt git en prod, sinon un déploiement l'écrase.
const AVATAR_DIR =
  process.env.AVATAR_DIR || path.join(__dirname, "..", "uploads", "avatars");

// Chemin public (servi par nginx en prod, par express.static en dev)
const AVATAR_PUBLIC_PATH = "/uploads/avatars";

// Base absolue utilisée pour construire l'URL stockée en base.
// On garde une URL absolue pour que le front web ET l'app mobile continuent
// d'utiliser `avatar` tel quel, sans aucune modification.
const PUBLIC_BASE_URL = (
  process.env.BACKEND_URL || "http://localhost:4000"
).replace(/\/+$/, "");

const AVATAR_SIZE = 256;
const WEBP_QUALITY = 80;
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];

// Création du dossier au démarrage (no-op s'il existe déjà)
fs.mkdirSync(AVATAR_DIR, { recursive: true });

/**
 * Uploader multer — stockage mémoire uniquement.
 * Aucune écriture disque ne se produit ici : c'est saveAvatar() qui écrit,
 * et il n'est appelé qu'après authentification.
 */
const avatarUploader = multer({
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

/** Nom de fichier déterministe : un userId ⇒ un seul chemin possible. */
function avatarFilename(userId) {
  return `${String(userId)}.webp`;
}

/**
 * Supprime le(s) fichier(s) avatar d'un utilisateur.
 *
 * On vise le nom déterministe, et on balaie aussi l'ancien schéma
 * `<userId>-<timestamp>.webp` pour ne pas laisser d'orphelin sur les
 * environnements où des avatars ont été écrits avant ce changement.
 */
async function removeAvatarFiles(userId) {
  const id = String(userId);
  let entries;
  try {
    entries = await fsp.readdir(AVATAR_DIR);
  } catch (err) {
    if (err.code === "ENOENT") return 0;
    throw err;
  }

  const targets = entries.filter(
    (f) => f === avatarFilename(id) || f.startsWith(`${id}-`),
  );
  await Promise.all(
    targets.map((f) =>
      fsp.unlink(path.join(AVATAR_DIR, f)).catch((err) => {
        if (err.code !== "ENOENT") {
          console.error(`⚠️  Suppression avatar ${f} échouée :`, err.message);
        }
      }),
    ),
  );
  return targets.length;
}

/**
 * Re-encode et enregistre l'avatar. Retourne l'URL publique absolue.
 *
 * Deux propriétés importantes :
 *
 *  1. Le nom de fichier est déterministe (`<userId>.webp`). Il est donc
 *     structurellement impossible d'avoir deux avatars pour un même
 *     utilisateur, quel que soit le nombre de requêtes simultanées ou de
 *     process PM2. Aucun verrou ni rate-limit n'est nécessaire pour ça.
 *
 *  2. L'écriture passe par un fichier temporaire puis un rename(), qui est
 *     atomique sur POSIX (même système de fichiers). Deux uploads simultanés
 *     ne peuvent donc pas produire un fichier à moitié écrit : le dernier
 *     rename gagne, et l'image reste toujours valide.
 *
 * Le cache-busting est assuré par le paramètre `?v=<timestamp>` de l'URL,
 * pas par le nom du fichier : l'URL change à chaque upload, ce qui permet
 * de garder un Cache-Control immutable côté nginx.
 */
async function saveAvatar(userId, buffer) {
  const id = String(userId);
  const filename = avatarFilename(id);
  const finalPath = path.join(AVATAR_DIR, filename);

  // .rotate() sans argument applique l'orientation EXIF puis la supprime
  // (photos de téléphone prises de travers).
  // sharp retire toutes les métadonnées par défaut : les coordonnées GPS
  // embarquées dans les photos de smartphone ne sont donc jamais publiées.
  const output = await sharp(buffer, { animated: false })
    .rotate()
    .resize(AVATAR_SIZE, AVATAR_SIZE, {
      fit: "cover",
      position: sharp.strategy.attention,
    })
    .webp({ quality: WEBP_QUALITY })
    .toBuffer();

  // Écriture atomique : temporaire + rename.
  // Le suffixe aléatoire est indispensable : un simple horodatage entre en
  // collision quand deux uploads tombent dans la même milliseconde, et les
  // deux requêtes écrivent alors dans le même fichier temporaire.
  const tmpPath = path.join(
    AVATAR_DIR,
    `.tmp-${id}-${crypto.randomBytes(8).toString("hex")}`,
  );
  try {
    await fsp.writeFile(tmpPath, output);
    await fsp.rename(tmpPath, finalPath);
  } catch (err) {
    await fsp.unlink(tmpPath).catch(() => {});
    throw err;
  }

  // Nettoyage des éventuels fichiers de l'ancien schéma horodaté.
  const stale = (await fsp.readdir(AVATAR_DIR)).filter((f) =>
    f.startsWith(`${id}-`),
  );
  await Promise.all(
    stale.map((f) => fsp.unlink(path.join(AVATAR_DIR, f)).catch(() => {})),
  );

  const version = Date.now();
  return {
    filename,
    bytes: output.length,
    url: `${PUBLIC_BASE_URL}${AVATAR_PUBLIC_PATH}/${filename}?v=${version}`,
  };
}

module.exports = {
  avatarUploader,
  saveAvatar,
  removeAvatarFiles,
  AVATAR_DIR,
  AVATAR_PUBLIC_PATH,
};
