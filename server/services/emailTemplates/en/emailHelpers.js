/**
 * Briques d'email en anglais.
 *
 * On ne recopie pas la mise en page : chaque brique vient de
 * `../emailHelpers.js` (la référence, inchangée), et seules les quelques
 * phrases écrites en dur dans ces briques sont remplacées ici. Un changement
 * de design dans les briques d'origine profite donc aussi aux emails anglais.
 *
 * ⚠️ Si une phrase française change dans `../emailHelpers.js`, le remplacement
 * correspondant ci-dessous ne trouvera plus rien : l'email anglais garderait
 * alors cette phrase en français. `scripts/test-emails-en.js` le vérifie.
 */
const fr = require("../emailHelpers");

/** Remplace `from` par `to`, et le signale si `from` est introuvable. */
function swap(html, from, to) {
  if (!html.includes(from)) {
    console.warn(`[emails en] phrase introuvable dans emailHelpers : "${from}"`);
    return html;
  }
  return html.replace(from, to);
}

const emailHeader = () => swap(fr.emailHeader(), '<html lang="fr">', '<html lang="en">');

const emailFooter = (unsubscribeHtml = "") =>
  swap(
    swap(fr.emailFooter(unsubscribeHtml), "Fait avec ❤️ par", "Made with ❤️ by"),
    "Conformité RGPD · LCEN · CNIL",
    "GDPR compliant",
  );

const ctaButtonWithApp = (url, label, appUrl) =>
  appUrl
    ? swap(
        fr.ctaButtonWithApp(url, label, appUrl),
        "📱 Ouvrir dans l'application",
        "📱 Open in the app",
      )
    : fr.ctaButtonWithApp(url, label, appUrl);

const linkFallback = (url) =>
  swap(
    fr.linkFallback(url),
    "Si le bouton ne fonctionne pas, copiez ce lien :",
    "If the button does not work, copy this link:",
  );

module.exports = {
  ...fr,
  emailHeader,
  emailFooter,
  ctaButtonWithApp,
  linkFallback,
};
