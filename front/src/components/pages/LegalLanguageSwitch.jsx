import { Link } from "react-router-dom";

/**
 * Bascule français / anglais en haut des pages légales.
 *
 * Les versions anglaises vivent sous `/en/<même adresse>` : `/cgu` et
 * `/en/cgu`, `/privacy` et `/en/privacy`… L'app mobile en anglais ouvre
 * directement ces adresses.
 *
 * @param {string} path  adresse de la page sans barre, ex. "cgu"
 * @param {"fr"|"en"} lang  langue de la page affichée
 */
export default function LegalLanguageSwitch({ path, lang }) {
  return (
    <div className="legal-lang">
      <p className="legal-lang-switch">
        {lang === "fr" ? (
          <>
            <strong>Français</strong> ·{" "}
            <Link to={`/en/${path}`} lang="en">
              English
            </Link>
          </>
        ) : (
          <>
            <Link to={`/${path}`} lang="fr">
              Français
            </Link>{" "}
            · <strong>English</strong>
          </>
        )}
      </p>
      {lang === "en" && (
        <p className="note">
          This English version is a translation provided for your convenience.
          If the two versions differ, the{" "}
          <Link to={`/${path}`} lang="fr">
            French version
          </Link>{" "}
          is the one that applies.
        </p>
      )}
    </div>
  );
}
