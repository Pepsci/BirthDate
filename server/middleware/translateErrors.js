const { requestLanguage } = require("../i18n");
const { translateMessage } = require("../i18n/messages.en");

/**
 * Traduit les messages d'erreur pour les clients qui demandent l'anglais.
 *
 * Les routes écrivent leurs messages en français (`res.status(400).json({
 * message: "…" })`). Plutôt que de toucher aux centaines d'endroits qui le
 * font, on intercepte la réponse ICI : si la requête porte
 * `X-App-Language: en` (l'app mobile en anglais) et que la réponse est une
 * erreur (statut ≥ 400), le champ `message` / `error` est remplacé par sa
 * traduction quand elle existe dans i18n/messages.en.js.
 *
 * Volontairement limité :
 *   - aux requêtes en anglais → le site web et l'app en français ne passent
 *     même pas par ce code ;
 *   - aux réponses d'erreur → on ne touche jamais au contenu d'une réponse
 *     réussie (documents, listes, messages de chat…) ;
 *   - aux textes connus → un message absent du dictionnaire part tel quel.
 * Les codes machine (`code: "ALREADY_HAS_LIST"`…) ne sont jamais modifiés :
 * les clients s'appuient dessus.
 */
function translateErrors(req, res, next) {
  const lang = requestLanguage(req);
  if (lang === "fr") return next();

  const sendJson = res.json.bind(res);
  res.json = (body) => {
    try {
      if (
        res.statusCode >= 400 &&
        body &&
        typeof body === "object" &&
        !Array.isArray(body)
      ) {
        let out = body;
        for (const field of ["message", "error"]) {
          if (typeof body[field] !== "string") continue;
          const translated = translateMessage(body[field], lang);
          if (translated !== body[field]) {
            if (out === body) out = { ...body };
            out[field] = translated;
          }
        }
        return sendJson(out);
      }
    } catch (err) {
      // Une traduction ne doit jamais empêcher une réponse de partir.
      console.error("[i18n] traduction de la réponse impossible:", err.message);
    }
    return sendJson(body);
  };
  next();
}

module.exports = { translateErrors };
