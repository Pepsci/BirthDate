import { Link } from "react-router-dom";
import "./css/legalPages.css";

export default function CookiesPolicy() {
  const handleManagePreferences = () => {
    document.cookie =
      "birthreminder-cookie-consent=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
    window.location.reload();
  };

  return (
    <div className="legal-page-container">
      <div className="legal-page-content">
        <Link to="/home" className="back-link">
          ← Retour à l'accueil
        </Link>

        <h1>🍪 Politique de Cookies</h1>
        <p className="intro">
          Cette page vous explique comment BirthReminder utilise les cookies et
          autres technologies similaires pour améliorer votre expérience.
        </p>

        <section>
          <h2>Qu'est-ce qu'un cookie ?</h2>
          <p>
            Un cookie est un petit fichier texte stocké sur votre appareil
            lorsque vous visitez un site web. Il permet au site de se souvenir
            de vos actions et préférences sur une période donnée.
          </p>
        </section>

        <section>
          <h2>Quels cookies utilisons-nous ?</h2>

          <div className="cookie-category">
            <h3>1. Cookies strictement nécessaires (obligatoires)</h3>
            <p>
              Ces cookies sont essentiels au fonctionnement du site. Sans eux,
              certaines fonctionnalités ne peuvent pas fonctionner.
            </p>
            <table>
              <thead>
                <tr>
                  <th>Nom</th>
                  <th>Finalité</th>
                  <th>Durée</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    <code>authToken</code>
                  </td>
                  <td>Authentification et session utilisateur</td>
                  <td>7 jours</td>
                </tr>
                <tr>
                  <td>
                    <code>birthreminder-cookie-consent</code>
                  </td>
                  <td>Mémoriser vos choix de cookies</td>
                  <td>1 an</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="cookie-category">
            <h3>2. Cookies analytiques (optionnels)</h3>
            <p>
              Ils nous aident à comprendre comment vous utilisez le site pour
              l'améliorer (pages visitées, temps passé, etc.).
            </p>
            <table>
              <thead>
                <tr>
                  <th>Nom</th>
                  <th>Finalité</th>
                  <th>Durée</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    <code>_ga</code>
                  </td>
                  <td>
                    Google Analytics - Identifier les utilisateurs uniques
                  </td>
                  <td>2 ans</td>
                </tr>
                <tr>
                  <td>
                    <code>_gid</code>
                  </td>
                  <td>Google Analytics - Distinguer les sessions</td>
                  <td>24 heures</td>
                </tr>
              </tbody>
            </table>
            <p className="note">
              <strong>Note :</strong> Actuellement, nous n'utilisons pas encore
              Google Analytics. Cette catégorie est réservée pour une
              utilisation future.
            </p>
          </div>

          <div className="cookie-category">
            <h3>3. Cookies fonctionnels (optionnels)</h3>
            <p>
              Ils améliorent votre expérience en mémorisant vos préférences et
              en activant certaines fonctionnalités.
            </p>
            <table>
              <thead>
                <tr>
                  <th>Nom</th>
                  <th>Finalité</th>
                  <th>Durée</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    <code>io</code>
                  </td>
                  <td>Socket.io - Chat en temps réel</td>
                  <td>Session</td>
                </tr>
                <tr>
                  <td>
                    <code>theme</code>
                  </td>
                  <td>Mémoriser votre préférence de mode sombre/clair</td>
                  <td>1 an</td>
                </tr>
                <tr>
                  <td>
                    <code>cookie-preferences</code>
                  </td>
                  <td>Stocker vos préférences de cookies détaillées</td>
                  <td>1 an</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2>Comment gérer vos cookies ?</h2>

          <h3>Sur BirthReminder</h3>
          <p>
            Vous pouvez modifier vos préférences à tout moment en cliquant sur
            le bouton ci-dessous :
          </p>

          <button
            onClick={handleManagePreferences}
            className="manage-cookies-btn"
          >
            🍪 Gérer mes préférences de cookies
          </button>

          <h3>Depuis votre navigateur</h3>
          <p>
            Vous pouvez également bloquer ou supprimer les cookies via les
            paramètres de votre navigateur :
          </p>
          <ul>
            <li>
              <strong>Chrome :</strong> Paramètres → Confidentialité et sécurité
              → Cookies
            </li>
            <li>
              <strong>Firefox :</strong> Options → Vie privée et sécurité →
              Cookies
            </li>
            <li>
              <strong>Safari :</strong> Préférences → Confidentialité → Cookies
            </li>
            <li>
              <strong>Edge :</strong> Paramètres → Cookies et autorisations de
              site
            </li>
          </ul>
        </section>

        <section>
          <h2>Durée de conservation</h2>
          <p>
            Les cookies sont conservés pendant la durée indiquée dans le tableau
            ci-dessus. Vous pouvez les supprimer à tout moment.
          </p>
        </section>

        <section>
          <h2>Mise à jour de cette politique</h2>
          <p>
            Nous pouvons mettre à jour cette politique de cookies pour refléter
            les changements dans nos pratiques. Nous vous encourageons à la
            consulter régulièrement.
          </p>
          <p className="last-update">
            <strong>Dernière mise à jour :</strong> 10 février 2026
          </p>
        </section>

        <section>
          <h2>Contact</h2>
          <p>
            Pour toute question concernant notre utilisation des cookies,
            contactez-nous à :{" "}
            <a href="mailto:contact@birthreminder.com">
              contact@birthreminder.com
            </a>
          </p>
        </section>
      </div>
    </div>
  );
}
