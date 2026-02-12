import { Link } from "react-router-dom";
import "./css/LegalPages.css";

export default function PrivacyPolicy() {
  return (
    <div className="legal-page-container">
      <div className="legal-page-content">
        <Link to="/home" className="back-link">
          ← Retour à l'accueil
        </Link>

        <h1>🔒 Politique de Confidentialité</h1>

        <p className="intro">
          Chez BirthReminder, nous respectons votre vie privée et nous nous
          engageons à protéger vos données personnelles. Cette politique
          explique quelles données nous collectons, pourquoi, et comment vous
          pouvez exercer vos droits.
        </p>

        <section>
          <h2>1. Responsable du traitement</h2>
          <p>Le responsable du traitement de vos données personnelles est :</p>
          <ul>
            <li>
              <strong>Nom :</strong> Joss Filippi
            </li>
            <li>
              <strong>Email :</strong>{" "}
              <a href="mailto:privacy@birthreminder.com">
                privacy@birthreminder.com
              </a>
            </li>
          </ul>
        </section>

        <section>
          <h2>2. Données collectées</h2>

          <h3>2.1 Données que vous nous fournissez</h3>
          <p>Lorsque vous utilisez BirthReminder, nous collectons :</p>
          <ul>
            <li>
              <strong>Informations de compte :</strong> Email, nom, prénom, mot
              de passe (crypté)
            </li>
            <li>
              <strong>Dates d'anniversaire :</strong> Nom, prénom, date de
              naissance des personnes que vous enregistrez
            </li>
            <li>
              <strong>Listes de souhaits :</strong> Idées cadeaux, liens, notes
              personnelles
            </li>
            <li>
              <strong>Messages :</strong> Conversations via le chat avec vos
              amis
            </li>
            <li>
              <strong>Relations sociales :</strong> Liste d'amis, demandes
              d'amis
            </li>
          </ul>

          <h3>2.2 Données collectées automatiquement</h3>
          <ul>
            <li>
              <strong>Données de connexion :</strong> Adresse IP, type de
              navigateur, système d'exploitation
            </li>
            <li>
              <strong>Cookies :</strong> Voir notre{" "}
              <Link to="/cookies">Politique de cookies</Link>
            </li>
            <li>
              <strong>Données d'utilisation :</strong> Pages visitées, temps
              passé, fonctionnalités utilisées
            </li>
          </ul>
        </section>

        <section>
          <h2>3. Finalités et bases légales du traitement</h2>

          <table>
            <thead>
              <tr>
                <th>Finalité</th>
                <th>Base légale</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Création et gestion de votre compte</td>
                <td>Exécution du contrat</td>
              </tr>
              <tr>
                <td>Envoi de notifications d'anniversaires</td>
                <td>Exécution du contrat</td>
              </tr>
              <tr>
                <td>Chat en temps réel avec vos amis</td>
                <td>Exécution du contrat</td>
              </tr>
              <tr>
                <td>Amélioration du service</td>
                <td>Intérêt légitime</td>
              </tr>
              <tr>
                <td>Envoi d'emails marketing (si accepté)</td>
                <td>Consentement</td>
              </tr>
              <tr>
                <td>Sécurité et prévention de la fraude</td>
                <td>Intérêt légitime</td>
              </tr>
            </tbody>
          </table>
        </section>

        <section>
          <h2>4. Durée de conservation</h2>
          <ul>
            <li>
              <strong>Compte actif :</strong> Vos données sont conservées tant
              que votre compte existe
            </li>
            <li>
              <strong>Après suppression du compte :</strong> Suppression
              définitive sous 30 jours
            </li>
            <li>
              <strong>Données de connexion :</strong> Conservées 1 an
              (obligation légale)
            </li>
            <li>
              <strong>Messages de chat :</strong> Conservés tant que votre
              compte existe, supprimés 30 jours après suppression du compte
            </li>
          </ul>
        </section>

        <section>
          <h2>5. Partage des données</h2>

          <h3>5.1 Avec d'autres utilisateurs</h3>
          <p>
            Lorsque vous ajoutez un ami sur BirthReminder, vous choisissez de
            partager certaines informations avec cette personne :
          </p>
          <ul>
            <li>Votre nom et prénom</li>
            <li>Votre date d'anniversaire</li>
            <li>Votre liste de souhaits (si vous la rendez visible)</li>
            <li>Les messages que vous lui envoyez via le chat</li>
          </ul>

          <h3>5.2 Avec des prestataires de services</h3>
          <p>Nous faisons appel à des prestataires pour :</p>
          <ul>
            <li>
              <strong>Hébergement :</strong> Amazon Web Services (AWS) - données
              hébergées en Europe
            </li>
            <li>
              <strong>Emails transactionnels :</strong> (à définir : Brevo,
              SendGrid, etc.)
            </li>
            <li>
              <strong>Analytics :</strong> (si applicable : Google Analytics
              avec anonymisation IP)
            </li>
          </ul>
          <p>
            Ces prestataires sont contractuellement tenus de protéger vos
            données et ne peuvent les utiliser qu'aux fins définies.
          </p>

          <h3>5.3 Transferts hors UE</h3>
          <p>
            Certains prestataires peuvent être situés hors de l'Union
            Européenne. Dans ce cas, nous nous assurons que des garanties
            appropriées sont en place (clauses contractuelles types, Privacy
            Shield, etc.).
          </p>
        </section>

        <section>
          <h2>6. Vos droits (RGPD)</h2>
          <p>Conformément au RGPD, vous disposez des droits suivants :</p>

          <ul>
            <li>
              <strong>✅ Droit d'accès :</strong> Obtenir une copie de vos
              données personnelles
            </li>
            <li>
              <strong>✏️ Droit de rectification :</strong> Corriger des données
              inexactes
            </li>
            <li>
              <strong>🗑️ Droit à l'effacement :</strong> Supprimer vos données
              (« droit à l'oubli »)
            </li>
            <li>
              <strong>⏸️ Droit à la limitation :</strong> Bloquer temporairement
              le traitement de vos données
            </li>
            <li>
              <strong>📦 Droit à la portabilité :</strong> Récupérer vos données
              dans un format structuré
            </li>
            <li>
              <strong>❌ Droit d'opposition :</strong> Vous opposer à certains
              traitements
            </li>
            <li>
              <strong>🔄 Droit de retirer votre consentement :</strong> À tout
              moment, pour les traitements basés sur le consentement
            </li>
          </ul>

          <h3>Comment exercer vos droits ?</h3>
          <p>Vous pouvez exercer vos droits :</p>
          <ul>
            <li>
              Directement depuis votre profil (suppression de compte, export de
              données)
            </li>
            <li>
              Par email à :{" "}
              <a href="mailto:privacy@birthreminder.com">
                privacy@birthreminder.com
              </a>
            </li>
          </ul>
          <p>
            Nous répondons à votre demande sous <strong>1 mois maximum</strong>.
          </p>

          <h3>Réclamation auprès de la CNIL</h3>
          <p>
            Si vous estimez que vos droits ne sont pas respectés, vous pouvez
            déposer une réclamation auprès de la CNIL (Commission Nationale de
            l'Informatique et des Libertés) :
          </p>
          <ul>
            <li>
              <strong>Site web :</strong>{" "}
              <a
                href="https://www.cnil.fr"
                target="_blank"
                rel="noopener noreferrer"
              >
                cnil.fr
              </a>
            </li>
            <li>
              <strong>Adresse :</strong> 3 Place de Fontenoy - TSA 80715 - 75334
              PARIS CEDEX 07
            </li>
          </ul>
        </section>

        <section>
          <h2>7. Sécurité des données</h2>
          <p>
            Nous mettons en œuvre des mesures de sécurité appropriées pour
            protéger vos données :
          </p>
          <ul>
            <li>🔐 Chiffrement des mots de passe (bcrypt)</li>
            <li>🔒 Connexions sécurisées HTTPS</li>
            <li>
              🛡️ Protection contre les attaques (CSRF, XSS, injection SQL)
            </li>
            <li>🔑 Authentification par tokens JWT</li>
            <li>💾 Sauvegardes régulières</li>
            <li>
              👥 Accès restreint aux données (principe du moindre privilège)
            </li>
          </ul>
        </section>

        <section>
          <h2>8. Mineurs</h2>
          <p>
            BirthReminder est destiné aux personnes majeures (18 ans et plus).
            Si vous avez moins de 18 ans, vous devez obtenir l'autorisation de
            vos parents avant de créer un compte.
          </p>
          <p>
            Si nous apprenons qu'un mineur de moins de 15 ans a créé un compte
            sans autorisation parentale, nous supprimerons immédiatement ce
            compte.
          </p>
        </section>

        <section>
          <h2>9. Modifications de cette politique</h2>
          <p>
            Nous pouvons modifier cette politique de confidentialité pour
            refléter les changements dans nos pratiques ou pour des raisons
            légales.
          </p>
          <p>
            Toute modification importante vous sera notifiée par email et/ou via
            une notification sur le site. Nous vous encourageons à consulter
            régulièrement cette page.
          </p>
        </section>

        <section>
          <h2>10. Contact</h2>
          <p>
            Pour toute question concernant cette politique de confidentialité ou
            vos données personnelles, contactez-nous :
          </p>
          <ul>
            <li>
              <strong>Email :</strong>{" "}
              <a href="mailto:privacy@birthreminder.com">
                privacy@birthreminder.com
              </a>
            </li>
            <li>
              <strong>Délai de réponse :</strong> Sous 48h maximum
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
