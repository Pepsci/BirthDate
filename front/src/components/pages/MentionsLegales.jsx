import { Link } from "react-router-dom";
import "./css/legalPages.css";

export default function MentionsLegales() {
  return (
    <div className="legal-page-container">
      <div className="legal-page-content">
        <Link to="/home" className="back-link">
          ← Retour à l'accueil
        </Link>

        <h1>⚖️ Mentions Légales</h1>

        <section>
          <h2>Éditeur du site</h2>
          <p>Le site BirthReminder est édité par :</p>
          <ul>
            <li>
              <strong>Nom :</strong> Josse Filippi
            </li>
            <li>
              <strong>Statut :</strong> Étudiant / Auto-entrepreneur (à adapter
              selon ton statut réel)
            </li>
            <li>
              <strong>Adresse :</strong> Paris, France
            </li>
            <li>
              <strong>Email :</strong>{" "}
              <a href="mailto:contact@birthreminder.com">
                contact@birthreminder.com
              </a>
            </li>
          </ul>
        </section>

        <section>
          <h2>Directeur de la publication</h2>
          <p>
            Le directeur de la publication du site est{" "}
            <strong>Josse Filippi</strong>.
          </p>
        </section>

        <section>
          <h2>Hébergement</h2>
          <p>Le site BirthReminder est hébergé par :</p>
          <ul>
            <li>
              <strong>Hébergeur :</strong> Amazon Web Services (AWS)
            </li>
            <li>
              <strong>Raison sociale :</strong> Amazon Web Services EMEA SARL
            </li>
            <li>
              <strong>Adresse :</strong> 38 Avenue John F. Kennedy, L-1855,
              Luxembourg
            </li>
            <li>
              <strong>Site web :</strong>{" "}
              <a
                href="https://aws.amazon.com"
                target="_blank"
                rel="noopener noreferrer"
              >
                aws.amazon.com
              </a>
            </li>
          </ul>
        </section>

        <section>
          <h2>Propriété intellectuelle</h2>
          <p>
            L'ensemble du contenu de ce site (textes, images, logos, code
            source) est la propriété exclusive de Josse Filippi, sauf mention
            contraire.
          </p>
          <p>
            Toute reproduction, distribution, modification ou utilisation de ces
            éléments sans autorisation préalable est strictement interdite et
            constitue une contrefaçon sanctionnée par le Code de la propriété
            intellectuelle.
          </p>
        </section>

        <section>
          <h2>Protection des données personnelles</h2>
          <p>
            Les informations collectées sur ce site font l'objet d'un traitement
            informatique destiné à la gestion des anniversaires et des relations
            amicales.
          </p>
          <p>
            Conformément au Règlement Général sur la Protection des Données
            (RGPD) et à la loi Informatique et Libertés, vous disposez d'un
            droit d'accès, de rectification, d'opposition, d'effacement, de
            limitation et de portabilité de vos données.
          </p>
          <p>
            Pour exercer ces droits, consultez notre{" "}
            <Link to="/privacy">Politique de confidentialité</Link> ou
            contactez-nous à{" "}
            <a href="mailto:privacy@birthreminder.com">
              privacy@birthreminder.com
            </a>
            .
          </p>
        </section>

        <section>
          <h2>Cookies</h2>
          <p>
            Ce site utilise des cookies pour améliorer votre expérience. Pour en
            savoir plus, consultez notre{" "}
            <Link to="/cookies">Politique de cookies</Link>.
          </p>
        </section>

        <section>
          <h2>Responsabilité</h2>
          <p>
            Nous nous efforçons de fournir des informations exactes et à jour.
            Toutefois, nous ne pouvons garantir l'exactitude, la complétude ou
            la pertinence des informations diffusées sur le site.
          </p>
          <p>
            L'utilisation des informations et contenus disponibles sur le site
            se fait sous votre entière responsabilité.
          </p>
        </section>

        <section>
          <h2>Litiges</h2>
          <p>
            Les présentes mentions légales sont soumises au droit français. En
            cas de litige, les tribunaux français seront seuls compétents.
          </p>
        </section>

        <section>
          <h2>Contact</h2>
          <p>
            Pour toute question concernant les mentions légales, vous pouvez
            nous contacter à :
          </p>
          <ul>
            <li>
              <strong>Email :</strong>{" "}
              <a href="mailto:contact@birthreminder.com">
                contact@birthreminder.com
              </a>
            </li>
          </ul>
        </section>

        <p className="last-update">
          <strong>Dernière mise à jour :</strong> 10 février 2026
        </p>
      </div>
    </div>
  );
}
