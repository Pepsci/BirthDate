import { Link, useLocation } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import "./css/notFound.css";

/**
 * Page « introuvable » : affichée pour toute adresse qui ne correspond à
 * aucune route (voir la route `path="*"` tout en bas de App.jsx).
 *
 * Sans elle, une adresse inconnue donnait une page blanche avec seulement le
 * pied de page : le visiteur ne savait pas si le site était cassé ou si le
 * lien était faux.
 *
 * `noindex` : le serveur répond toujours 200 pour une application à page
 * unique, donc c'est cette balise qui dit aux moteurs de ne pas référencer
 * une adresse qui n'existe pas.
 */
export default function NotFound() {
  const { pathname } = useLocation();

  return (
    <div className="not-found">
      <Helmet>
        <title>Page introuvable – BirthReminder</title>
        <meta name="robots" content="noindex" />
      </Helmet>

      <div className="not-found-card">
        <p className="not-found-emoji" aria-hidden="true">
          🎈
        </p>
        <p className="not-found-code">Erreur 404</p>
        <h1>Cette page n'existe pas</h1>
        <p className="not-found-text">
          Le lien est peut-être incomplet, ou la page a été déplacée.
        </p>
        <p className="not-found-path">{pathname}</p>

        <div className="not-found-actions">
          <Link to="/" className="not-found-btn not-found-btn--primary">
            Retour à l'accueil
          </Link>
          <Link to="/contact" className="not-found-btn">
            Nous contacter
          </Link>
        </div>
      </div>
    </div>
  );
}
