// utils/signupSource.js
// Provenance d'une inscription : par où la personne est arrivée.
//
// Pourquoi côté serveur : PostHog ne voit que le site web, et seulement les
// visiteurs qui ont accepté les cookies analytics. Une inscription depuis
// l'app mobile, ou depuis le site sans consentement, n'y laisse aucune trace.
// Ici on enregistre le strict nécessaire dans le journal d'audit, au moment
// de l'inscription, sans cookie ni stockage sur l'appareil.
//
// Minimisation : du referrer on ne garde que le NOM DE DOMAINE (jamais l'URL
// complète), de la page d'arrivée que le CHEMIN (jamais la query string, qui
// peut contenir un token).

const PLATFORMS = ["web", "ios", "android"];

// Chemins dont un segment est un secret : on ne les enregistre pas tels quels.
const SECRET_PATH_PREFIXES = ["/auth/reset", "/verify-email", "/unsubscribe"];

function cleanString(value, max) {
  if (typeof value !== "string") return undefined;
  // Caractères de contrôle retirés : la valeur est affichée dans l'admin.
  const cleaned = value.replace(/[\u0000-\u001f\u007f]/g, "").trim();
  return cleaned ? cleaned.slice(0, max) : undefined;
}

/**
 * Plateforme déduite du User-Agent. Sert de repli quand le client ne déclare
 * rien : donc aussi pour TOUTES les inscriptions antérieures à ce fichier.
 *  - React Native Android passe par OkHttp ("okhttp/4.x")
 *  - React Native iOS passe par CFNetwork ("BirthReminder/43 CFNetwork/… Darwin/…")
 *  - un navigateur s'annonce toujours "Mozilla/5.0 …"
 */
function platformFromUserAgent(userAgent) {
  const ua = String(userAgent || "");
  if (!ua) return null;
  if (/okhttp/i.test(ua)) return "android";
  if (/CFNetwork|Darwin/i.test(ua)) return "ios";
  if (/Mozilla/i.test(ua)) return "web";
  return null;
}

/** Nom lisible du navigateur et du système, pour l'affichage admin. */
function browserFromUserAgent(userAgent) {
  const ua = String(userAgent || "");
  if (!/Mozilla/i.test(ua)) return null;

  let os = null;
  if (/iPhone|iPad|iPod/.test(ua)) os = "iOS";
  else if (/Android/.test(ua)) os = "Android";
  else if (/Macintosh/.test(ua)) os = "Mac";
  else if (/Windows/.test(ua)) os = "Windows";
  else if (/Linux/.test(ua)) os = "Linux";

  // L'ordre compte : Chrome s'annonce aussi "Safari", Edge aussi "Chrome".
  let browser = null;
  if (/FBAN|FBAV|Instagram/.test(ua)) browser = "navigateur intégré (Meta)";
  else if (/Edg\//.test(ua)) browser = "Edge";
  else if (/Firefox\/|FxiOS/.test(ua)) browser = "Firefox";
  else if (/Chrome\/|CriOS/.test(ua)) browser = "Chrome";
  else if (/Safari\//.test(ua)) browser = "Safari";

  return [browser, os].filter(Boolean).join(" · ") || null;
}

function hostFromReferrer(referrer) {
  const raw = cleanString(referrer, 500);
  if (!raw) return undefined;
  try {
    const host = new URL(raw).hostname.replace(/^www\./, "");
    // Navigation interne au site : ce n'est pas une provenance.
    if (!host || /(^|\.)birthreminder\.(com|fr)$/.test(host) || host === "localhost") {
      return undefined;
    }
    return host.slice(0, 100);
  } catch (_) {
    return undefined;
  }
}

function cleanLandingPath(path) {
  const raw = cleanString(path, 300);
  if (!raw || !raw.startsWith("/")) return undefined;
  const pathname = raw.split(/[?#]/)[0];
  if (SECRET_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return undefined;
  }
  return pathname.slice(0, 120);
}

/**
 * Construit la provenance à ranger dans `Log.metadata` de l'action "signup".
 * Ne lève jamais : une provenance illisible ne doit pas bloquer une inscription.
 *
 * @param {import("express").Request} req
 * @returns {{platform?: string, appVersion?: string, referrer?: string,
 *            landingPath?: string, utm?: object}}
 */
function buildSignupSource(req) {
  try {
    const body = req.body || {};
    const declared = cleanString(body.platform, 20);
    const platform = PLATFORMS.includes(declared)
      ? declared
      : platformFromUserAgent(req.headers["user-agent"]);

    const source = body.source && typeof body.source === "object" ? body.source : {};
    const utm = {
      source: cleanString(source.utmSource, 80),
      medium: cleanString(source.utmMedium, 80),
      campaign: cleanString(source.utmCampaign, 80),
    };
    const hasUtm = Object.values(utm).some(Boolean);

    const result = {
      platform: platform || undefined,
      appVersion: cleanString(body.appVersion, 20),
      referrer: hostFromReferrer(source.referrer),
      landingPath: cleanLandingPath(source.landingPath),
      utm: hasUtm ? utm : undefined,
    };
    // Pas de clés vides en base : le journal reste lisible.
    return JSON.parse(JSON.stringify(result));
  } catch (_) {
    return {};
  }
}

module.exports = {
  buildSignupSource,
  platformFromUserAgent,
  browserFromUserAgent,
};
