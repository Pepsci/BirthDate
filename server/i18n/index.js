/**
 * i18n côté serveur, textes écrits PAR le serveur pour un utilisateur :
 * notifications push, emails, messages d'erreur renvoyés à l'app mobile.
 *
 * Deux sources de langue, selon le moment :
 *   - `User.language` : la langue du compte, envoyée par l'app mobile (langue
 *     du téléphone, ou choix dans Profil). Sert quand l'utilisateur n'est pas
 *     là : push, emails, rappels des crons.
 *   - l'en-tête `Accept-Language` de la requête en cours : sert pour les
 *     messages d'erreur (voir middleware/translateErrors.js).
 *
 * Le français reste la langue par défaut PARTOUT : un compte sans langue, une
 * langue inconnue ou une clé absente donnent le texte français d'origine.
 * Le site web, qui n'envoie rien, n'est donc pas concerné.
 *
 * Ajouter une langue : un fichier `locales/<code>.json`, le code dans
 * SUPPORTED_LANGUAGES, et l'enum de `User.language`.
 */
const SUPPORTED_LANGUAGES = ["fr", "en"];
const DEFAULT_LANGUAGE = "fr";

const dictionaries = {
  fr: require("./locales/fr.json"),
  en: require("./locales/en.json"),
};

/** Ramène n'importe quelle valeur ("en-GB", "EN", undefined…) à une langue gérée. */
function normalizeLanguage(value) {
  const code = String(value || "")
    .trim()
    .toLowerCase()
    .split(/[-_,;]/)[0];
  return SUPPORTED_LANGUAGES.includes(code) ? code : DEFAULT_LANGUAGE;
}

/** Valeur stricte pour `User.language` : null si la langue n'est pas gérée. */
function parseLanguage(value) {
  const code = String(value || "")
    .trim()
    .toLowerCase()
    .split(/[-_]/)[0];
  return SUPPORTED_LANGUAGES.includes(code) ? code : null;
}

function lookup(dictionary, key) {
  return key.split(".").reduce(
    (node, part) => (node && typeof node === "object" ? node[part] : undefined),
    dictionary,
  );
}

function interpolate(text, vars) {
  if (!vars) return text;
  return text.replace(/\{\{(\w+)\}\}/g, (_, name) =>
    vars[name] === undefined || vars[name] === null ? "" : String(vars[name]),
  );
}

/**
 * Texte d'une clé ("push.event.cancelledTitle") dans la langue demandée.
 * Clé absente en anglais → français ; absente partout → la clé elle-même,
 * et une ligne dans les logs (c'est une faute de frappe à corriger).
 */
function t(lang, key, vars) {
  const language = normalizeLanguage(lang);
  let text = lookup(dictionaries[language], key);
  if (typeof text !== "string") text = lookup(dictionaries[DEFAULT_LANGUAGE], key);
  if (typeof text !== "string") {
    console.warn(`[i18n] clé manquante : ${key}`);
    return key;
  }
  return interpolate(text, vars);
}

/**
 * Pluriel : `cle.one` ou `cle.other`, avec `count` disponible dans le texte.
 * En français 0 et 1 sont au singulier, en anglais seul 1 l'est.
 */
function tn(lang, key, count, vars) {
  const language = normalizeLanguage(lang);
  const singular = language === "fr" ? count < 2 : count === 1;
  return t(language, `${key}.${singular ? "one" : "other"}`, { count, ...vars });
}

/** Traducteur lié à une langue : `const L = translator(user.language)`. */
function translator(lang) {
  const language = normalizeLanguage(lang);
  const L = (key, vars) => t(language, key, vars);
  L.n = (key, count, vars) => tn(language, key, count, vars);
  L.language = language;
  /** Balise de locale pour toLocaleDateString & co. */
  L.locale = language === "en" ? "en-GB" : "fr-FR";
  return L;
}

/**
 * Langue d'un compte. Jamais bloquant : en cas d'erreur de lecture, on
 * retombe sur le français plutôt que de perdre une notification.
 */
async function getUserLanguage(userId) {
  if (!userId) return DEFAULT_LANGUAGE;
  try {
    const User = require("../models/user.model");
    const user = await User.findById(userId).select("language").lean();
    return normalizeLanguage(user?.language);
  } catch (err) {
    console.error("[i18n] lecture de la langue impossible:", err.message);
    return DEFAULT_LANGUAGE;
  }
}

/**
 * Langue demandée par la requête en cours : en-tête `X-App-Language`, envoyé
 * par l'app mobile.
 *
 * ⚠️ Pas `Accept-Language` : un navigateur l'envoie tout seul. Le site web
 * est en français ; un visiteur dont le navigateur est en anglais recevrait
 * des messages d'erreur anglais au milieu d'une page française.
 */
function requestLanguage(req) {
  return normalizeLanguage(req?.headers?.["x-app-language"]);
}

/**
 * Un texte à destination d'un utilisateur peut être donné :
 *   - tel quel (chaîne) : il est envoyé sans traduction ;
 *   - sous forme de fonction `(L) => L("cle", vars)` : il est résolu dans la
 *     langue du destinataire au moment de l'envoi.
 */
function resolveText(value, L) {
  return typeof value === "function" ? value(L) : value;
}

module.exports = {
  SUPPORTED_LANGUAGES,
  DEFAULT_LANGUAGE,
  normalizeLanguage,
  parseLanguage,
  t,
  tn,
  translator,
  getUserLanguage,
  requestLanguage,
  resolveText,
};
