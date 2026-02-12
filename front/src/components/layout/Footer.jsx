import { Link } from "react-router-dom";
import "./css/footer.css";

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-container">
        {/* Colonne 1 - Produit */}
        <div className="footer-column">
          <h3 className="footer-title">Produit</h3>
          <ul className="footer-links">
            <li>
              <Link to="/home">Accueil</Link>
            </li>
            <li>
              <Link to="/profile">Mon profil</Link>
            </li>
            <li>
              <a href="#premium">Premium (bientôt)</a>
            </li>
          </ul>
        </div>

        {/* Colonne 2 - Support */}
        <div className="footer-column">
          <h3 className="footer-title">Support</h3>
          <ul className="footer-links">
            <li>
              <a href="mailto:contact@birthreminder.com">Contact</a>
            </li>
            <li>
              <a href="mailto:support@birthreminder.com">Aide</a>
            </li>
            <li>
              <Link to="/profile">Mon compte</Link>
            </li>
          </ul>
        </div>

        {/* Colonne 3 - Légal */}
        <div className="footer-column">
          <h3 className="footer-title">Légal</h3>
          <ul className="footer-links">
            <li>
              <Link to="/mentions-legales">Mentions légales</Link>
            </li>
            <li>
              <Link to="/cgu">CGU</Link>
            </li>
            <li>
              <Link to="/privacy">Confidentialité</Link>
            </li>
            <li>
              <Link to="/cookies">Cookies</Link>
            </li>
          </ul>
        </div>

        {/* Colonne 4 - À propos */}
        <div className="footer-column">
          <h3 className="footer-title">À propos</h3>
          <ul className="footer-links">
            <li>
              <a
                href="https://github.com/joss-filippi"
                target="_blank"
                rel="noopener noreferrer"
              >
                GitHub
              </a>
            </li>
            <li>
              <a
                href="https://linkedin.com/in/joss-filippi"
                target="_blank"
                rel="noopener noreferrer"
              >
                LinkedIn
              </a>
            </li>
            <li>
              <a href="mailto:hello@birthreminder.com">Nous contacter</a>
            </li>
          </ul>
        </div>
      </div>

      {/* Séparateur */}
      <div className="footer-divider"></div>

      {/* Copyright */}
      <div className="footer-bottom">
        <p className="footer-copyright">
          © 2026 BirthReminder • Fait avec ❤️ par Joss Filippi
        </p>
        <p className="footer-legal-notice">Conformité RGPD • LCEN • CNIL</p>
      </div>
    </footer>
  );
}
