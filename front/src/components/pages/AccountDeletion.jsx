import { Link } from "react-router-dom";
import "./css/legalPages.css";

/**
 * Page publique de demande de suppression de compte.
 *
 * ⚠️ Exigée par Google Play : l'URL doit être accessible SANS installer
 * l'application, nommer l'app, décrire la procédure pas à pas, et préciser ce
 * qui est supprimé, ce qui est conservé et pendant combien de temps.
 * Elle est donc volontairement hors des routes privées, et ne doit jamais
 * passer derrière une authentification.
 *
 * Le contenu doit rester aligné sur la route DELETE /users/:id
 * (server/routes/users.js) et sur le cron jobs/purgeDeletedAccounts.js.
 */
export default function AccountDeletion() {
  return (
    <div className="legal-page-container">
      <div className="legal-page-content">
        <Link to="/" className="back-link">
          ← Retour à l'accueil
        </Link>

        <h1>🗑️ Supprimer son compte BirthReminder</h1>
        <p className="intro">
          Cette page explique comment demander la suppression de votre compte
          BirthReminder et des données associées, ce qui est supprimé, et ce qui
          est conservé.
        </p>

        <section>
          <h2>1. Depuis l'application ou le site</h2>
          <p>C'est la méthode la plus rapide, et elle est immédiate :</p>
          <ol>
            <li>Connectez-vous à votre compte BirthReminder</li>
            <li>
              Ouvrez l'onglet <strong>Profil</strong>
            </li>
            <li>
              Faites défiler jusqu'à <strong>« Supprimer mon compte »</strong>
            </li>
            <li>Confirmez la suppression</li>
          </ol>
          <p>
            La procédure est identique sur l'application Android, sur
            l'application iPhone et sur le site <strong>birthreminder.com</strong>.
          </p>
        </section>

        <section>
          <h2>2. Sans passer par l'application</h2>
          <p>
            Si vous n'avez plus accès à votre compte, écrivez-nous depuis{" "}
            <Link to="/contact">le formulaire de contact</Link> ou à
            l'adresse <strong>contact@birthreminder.com</strong>, en indiquant
            l'adresse e-mail du compte concerné. Nous vérifions qu'il s'agit
            bien de votre compte, puis nous procédons à la suppression.
          </p>
          <p>
            Vous pouvez aussi, par ce même moyen, demander la suppression{" "}
            <strong>d'une partie seulement</strong> de vos données (une carte,
            une wishlist, vos messages) sans supprimer votre compte.
          </p>
        </section>

        <section>
          <h2>3. Ce qui est supprimé</h2>
          <ul>
            <li>
              <strong>Immédiatement :</strong> votre photo de profil, votre nom
              et votre adresse e-mail (le compte est anonymisé), vos cartes
              d'anniversaire, celles que vos amis avaient de vous, vos relations
              d'amitié et vos wishlists
            </li>
            <li>
              <strong>Sous 30 jours :</strong> suppression définitive du compte
              et de vos messages. Ce délai permet de revenir en arrière en cas
              de suppression accidentelle
            </li>
          </ul>
          <p>
            Vos messages déjà reçus par vos correspondants restent dans{" "}
            <em>leur</em> conversation, sous la mention « Utilisateur supprimé »,
            comme une conversation effacée d'un seul côté. Ils sont chiffrés de
            bout en bout et illisibles pour nous.
          </p>
        </section>

        <section>
          <h2>4. Ce qui est conservé, et pourquoi</h2>
          <ul>
            <li>
              <strong>Journaux de connexion : 1 an.</strong> Obligation légale
              (sécurité et lutte contre la fraude)
            </li>
            <li>
              <strong>Participations à une cagnotte :</strong> conservées de
              façon anonymisée, le temps prévu par les obligations comptables.
              Ce sont des mouvements d'argent : ils ne peuvent pas être effacés
              à la demande. Les paiements sont traités par Stripe, qui applique
              ses propres durées de conservation
            </li>
          </ul>
        </section>

        <section>
          <h2>5. Une question ?</h2>
          <p>
            Écrivez-nous depuis <Link to="/contact">le formulaire de contact</Link>{" "}
            ou à <strong>contact@birthreminder.com</strong>. Le détail complet
            du traitement de vos données figure dans{" "}
            <Link to="/privacy">notre politique de confidentialité</Link>.
          </p>
        </section>
      </div>
    </div>
  );
}
