import { Link } from "react-router-dom";
import "./css/legalPages.css";

export default function CGU() {
  return (
    <div className="legal-page-container">
      <div className="legal-page-content">
        <Link to="/home" className="back-link">
          ← Retour à l'accueil
        </Link>

        <h1>📜 Conditions Générales d'Utilisation</h1>

        <p className="intro">
          Les présentes Conditions Générales d'Utilisation (CGU) régissent
          l'utilisation du service BirthReminder. En utilisant notre service,
          vous acceptez ces conditions dans leur intégralité.
        </p>

        <section>
          <h2>1. Objet</h2>
          <p>
            BirthReminder est un service en ligne permettant de gérer et de
            recevoir des rappels pour les anniversaires de vos proches. Le
            service comprend :
          </p>
          <ul>
            <li>La gestion de dates d'anniversaire</li>
            <li>L'envoi de notifications par email</li>
            <li>Un système d'amis pour partager des dates</li>
            <li>Un chat en temps réel entre amis</li>
            <li>La gestion de listes de souhaits</li>
            <li>Un organisateur d'événements (fonctionnalité à venir)</li>
          </ul>
        </section>

        <section>
          <h2>2. Accès au service</h2>

          <h3>2.1 Création de compte</h3>
          <p>
            Pour utiliser BirthReminder, vous devez créer un compte en
            fournissant :
          </p>
          <ul>
            <li>Une adresse email valide</li>
            <li>Un nom et un prénom</li>
            <li>
              Un mot de passe sécurisé (minimum 8 caractères, 1 majuscule, 1
              minuscule, 1 chiffre)
            </li>
          </ul>

          <h3>2.2 Vérification d'email</h3>
          <p>
            Vous devez vérifier votre adresse email en cliquant sur le lien
            envoyé lors de l'inscription. Sans cette vérification, vous ne
            pourrez pas accéder au service.
          </p>

          <h3>2.3 Conditions d'âge</h3>
          <p>
            Le service BirthReminder est conçu pour un usage familial et peut
            être utilisé par tous les âges, sous conditions :
          </p>

          <h4>Utilisateurs de 15 ans et plus</h4>
          <p>Peuvent créer un compte et utiliser le service librement.</p>

          <h4>Utilisateurs de moins de 15 ans</h4>
          <p>Un parent ou tuteur légal doit :</p>
          <ul>
            <li>
              Créer le compte au nom du mineur <strong>OU</strong>
            </li>
            <li>
              Donner son consentement explicite lors de la création du compte
            </li>
          </ul>

          <p>
            En créant un compte pour un mineur ou en donnant votre consentement,
            vous :
          </p>
          <ul>
            <li>✓ Certifiez avoir l'autorité parentale ou tutélaire</li>
            <li>
              ✓ Acceptez d'être responsable de l'utilisation du service par le
              mineur
            </li>
            <li>
              ✓ Pouvez à tout moment demander la modification ou suppression du
              compte
            </li>
          </ul>

          <h4>Vérification du consentement parental</h4>
          <p>
            BirthReminder se réserve le droit de demander une preuve du
            consentement parental à tout moment. Le compte peut être suspendu
            jusqu'à réception de cette preuve.
          </p>

          <p className="warning">
            ⚠️ Les comptes créés par des mineurs de moins de 15 ans sans
            consentement parental documenté seront suspendus, puis supprimés
            sous 30 jours en l'absence de régularisation.
          </p>
        </section>

        <section>
          <h2>3. Utilisation du service</h2>

          <h3>3.1 Obligations de l'utilisateur</h3>
          <p>En utilisant BirthReminder, vous vous engagez à :</p>
          <ul>
            <li>Fournir des informations exactes et à jour</li>
            <li>Maintenir la confidentialité de votre mot de passe</li>
            <li>Ne pas partager votre compte avec des tiers</li>
            <li>Respecter les autres utilisateurs</li>
            <li>
              Ne pas utiliser le service à des fins illégales ou malveillantes
            </li>
            <li>Ne pas tenter de contourner les mesures de sécurité</li>
            <li>
              Ne pas envoyer de spam ou de contenu inapproprié via le chat
            </li>
          </ul>

          <h3>3.2 Comportements interdits</h3>
          <p>Il est strictement interdit de :</p>
          <ul>
            <li>Harceler, menacer ou insulter d'autres utilisateurs</li>
            <li>Publier du contenu illégal, offensant, ou discriminatoire</li>
            <li>Usurper l'identité d'une autre personne</li>
            <li>Tenter d'accéder aux comptes d'autres utilisateurs</li>
            <li>Utiliser des scripts ou bots pour automatiser des actions</li>
            <li>
              Collecter des données d'autres utilisateurs sans leur consentement
            </li>
            <li>Perturber le fonctionnement du service</li>
          </ul>
          <p className="warning">
            ⚠️ Tout manquement à ces règles peut entraîner la suspension ou la
            suppression définitive de votre compte sans préavis.
          </p>

          <h3>3.3 Signaler un contenu ou un utilisateur</h3>
          <p>
            Chaque message, proposition de cadeau ou liste de souhaits peut être
            signalé depuis l'application, en indiquant un motif (spam,
            harcèlement, contenu inapproprié, arnaque). Le signalement est
            transmis à notre équipe de modération.
          </p>
          <p>
            Nous nous engageons à examiner chaque signalement dans un délai
            raisonnable, en principe sous 72 heures. Selon la gravité, nous
            pouvons supprimer le contenu, avertir l'auteur, suspendre son compte
            ou le supprimer définitivement. Les éléments signalés sont conservés
            le temps nécessaire au traitement, même si l'un des utilisateurs a
            retiré la conversation de sa liste.
          </p>
          <p>
            Si votre compte est suspendu ou supprimé et que vous estimez la
            décision injustifiée, vous pouvez la contester en écrivant à{" "}
            <a href="mailto:contact@birthreminder.com">
              contact@birthreminder.com
            </a>
            . Nous réexaminerons votre situation.
          </p>

          <h3>3.4 Bloquer un utilisateur</h3>
          <p>
            Vous pouvez bloquer un utilisateur à tout moment. Le blocage
            empêche cette personne de vous envoyer des messages, des demandes
            d'ami, des invitations à un événement ou à une liste de cadeaux
            commune. Elle n'est pas informée du blocage. Vous pouvez consulter
            et lever vos blocages depuis votre profil.
          </p>
        </section>

        <section>
          <h2>4. Contenu utilisateur</h2>

          <h3>4.1 Propriété du contenu</h3>
          <p>
            Vous conservez tous les droits sur le contenu que vous créez sur
            BirthReminder (dates, listes de souhaits, messages, etc.). En
            utilisant le service, vous nous accordez une licence limitée pour
            stocker, traiter et afficher ce contenu dans le cadre du service.
          </p>

          <h3>4.2 Responsabilité du contenu</h3>
          <p>
            Vous êtes seul responsable du contenu que vous publiez.
            BirthReminder n'est pas responsable du contenu créé par les
            utilisateurs et se réserve le droit de supprimer tout contenu
            inapproprié.
          </p>

          <h3>4.3 Liens produits et liens affiliés</h3>
          <p>
            Lorsque vous ajoutez un lien produit à une liste de souhaits, nous
            tentons d'en extraire automatiquement le titre, le prix et l'image.
          </p>
          <p className="warning">
            ⚠️ Certains liens marchands, notamment ceux pointant vers Amazon,
            sont transformés en liens affiliés. Si un achat est effectué depuis
            l'un de ces liens, nous pouvons percevoir une commission de la part
            du marchand.{" "}
            <strong>
              Cela n'entraîne aucun surcoût pour vous et ne modifie ni le prix
              ni le produit.
            </strong>{" "}
            Cette rémunération n'influence pas les produits qui vous sont
            présentés : ce sont ceux que vous ou vos amis avez choisis.
          </p>

          <h3>4.4 Partager une carte anniversaire</h3>
          <p>
            Vous pouvez transmettre à un ami une carte anniversaire (prénom,
            nom, date de naissance, fête). Vos idées cadeaux ne sont jamais
            incluses. Le destinataire peut enregistrer cette carte chez lui ; la
            copie qu'il obtient est indépendante de la vôtre et n'est pas mise à
            jour si vous modifiez la vôtre.
          </p>
          <p>
            Si la personne concernée possède un compte, le destinataire peut lui
            adresser une demande d'ami :{" "}
            <strong>elle devra l'accepter pour que le lien s'établisse</strong>.
            Ne partagez une carte qu'avec des personnes légitimes à connaître
            ces informations.
          </p>

          <h3>4.5 Retirer une conversation</h3>
          <p>
            Retirer une conversation la fait disparaître de votre liste et
            masque les messages antérieurs, pour vous seul.{" "}
            <strong>
              Votre correspondant conserve sa copie des échanges.
            </strong>{" "}
            Nul ne peut effacer des messages chez autrui, notamment lorsqu'ils
            servent de preuve après un signalement. Les modalités et les durées
            de conservation sont détaillées dans notre politique de
            confidentialité.
          </p>

          <h3>4.6 Récupérer vos données</h3>
          <p>
            Vous pouvez à tout moment télécharger une copie de vos données
            depuis votre profil. Vos messages étant chiffrés de bout en bout,
            ils sont déchiffrés par votre appareil au moment de l'export : si
            votre clé n'y est pas présente, les messages concernés resteront
            illisibles.
          </p>
        </section>

        <section>
          <h2>5. Cagnottes d'événement</h2>

          <p>
            L'organisateur d'un événement peut ouvrir une cagnotte pour financer
            un cadeau commun. Lisez attentivement cette section : elle définit
            qui est responsable de l'argent collecté.
          </p>

          <h3>5.1 Le rôle de BirthReminder</h3>
          <p className="warning">
            ⚠️ BirthReminder n'est pas un établissement de paiement, ne détient
            jamais les fonds et ne perçoit aucune commission sur les cagnottes.
            Nous fournissons uniquement l'outil qui permet à un organisateur de
            collecter de l'argent auprès de ses invités.
          </p>
          <p>
            Les paiements par carte sont encaissés{" "}
            <strong>directement sur le compte de l'organisateur</strong> auprès
            de notre prestataire Stripe. À aucun moment les sommes ne transitent
            par un compte BirthReminder.
          </p>

          <h3>5.2 Responsabilité de l'organisateur</h3>
          <p>
            L'organisateur qui ouvre une cagnotte est seul responsable :
          </p>
          <ul>
            <li>de l'usage des sommes collectées, conformément à ce qu'il a
              annoncé aux participants ;</li>
            <li>de leur restitution en cas d'annulation de l'événement ou si le
              cadeau n'est finalement pas acheté ;</li>
            <li>de l'exactitude des informations qu'il communique (montant
              visé, destination du cadeau, échéance) ;</li>
            <li>de ses éventuelles obligations déclaratives ou fiscales.</li>
          </ul>
          <p>
            En ouvrant une cagnotte, il doit créer un compte auprès de Stripe et
            se soumettre à ses vérifications d'identité. Il accepte les
            conditions de Stripe en plus des présentes.
          </p>

          <h3>5.3 Responsabilité du participant</h3>
          <p>
            Contribuer à une cagnotte est un acte volontaire entre
            particuliers. Vous ne contribuez qu'auprès de personnes que vous
            connaissez et à qui vous faites confiance. Une contribution n'est
            pas l'achat d'un bien ou d'un service : le droit de rétractation
            applicable aux achats en ligne ne s'y applique pas.
          </p>

          <h3>5.4 Litiges</h3>
          <p>
            Tout différend relatif à une cagnotte se règle{" "}
            <strong>entre le participant et l'organisateur</strong>.
            BirthReminder n'arbitre pas ces litiges et ne peut ni rembourser ni
            reverser des sommes qu'il ne détient pas. Le remboursement d'un
            paiement par carte relève du compte Stripe de l'organisateur ; à
            défaut, votre banque reste votre interlocuteur.
          </p>
          <p>
            Pour les paiements par carte, nous conservons trace de chaque
            contribution : identité du contributeur, montant, date et référence
            du paiement. Ces éléments peuvent être communiqués aux personnes
            concernées ou aux autorités compétentes sur demande légitime.
          </p>

          <h3>5.5 Cagnotte par virement bancaire</h3>
          <p className="warning">
            ⚠️ L'organisateur peut choisir de communiquer ses coordonnées
            bancaires plutôt que de passer par le paiement par carte. Dans ce
            cas, les virements se font de banque à banque, en dehors de nos
            services :{" "}
            <strong>
              nous n'en conservons aucune trace et ne pouvons produire aucune
              preuve de versement en cas de litige.
            </strong>{" "}
            Ce mode repose entièrement sur la confiance que vous accordez à
            l'organisateur.
          </p>

          <h3>5.6 Gratuité du service</h3>
          <p>
            L'ensemble des fonctionnalités de BirthReminder est aujourd'hui
            gratuit et sans publicité : dates illimitées, amis illimités, chat
            chiffré, événements, listes de souhaits, export de vos données. Une
            offre payante pourra être proposée à l'avenir ; elle ferait alors
            l'objet d'une mise à jour des présentes conditions et ne
            restreindrait pas rétroactivement ce dont vous disposez.
          </p>
        </section>

        <section>
          <h2>6. Disponibilité du service</h2>

          <h3>6.1 Disponibilité</h3>
          <p>
            Nous nous efforçons de maintenir le service accessible 24h/24 et
            7j/7. Cependant, nous ne garantissons pas une disponibilité
            ininterrompue et nous réservons le droit d'effectuer des
            maintenances.
          </p>

          <h3>6.2 Modifications du service</h3>
          <p>
            Nous pouvons modifier, suspendre ou interrompre tout ou partie du
            service à tout moment, avec ou sans préavis. Nous nous efforcerons
            de vous informer à l'avance des modifications importantes.
          </p>
        </section>

        <section>
          <h2>7. Résiliation</h2>

          <h3>7.1 Par l'utilisateur</h3>
          <p>
            Vous pouvez supprimer votre compte à tout moment depuis votre
            profil. Vos données seront anonymisées immédiatement et supprimées
            définitivement sous 30 jours.
          </p>

          <h3>7.2 Par BirthReminder</h3>
          <p>
            Nous nous réservons le droit de suspendre ou supprimer votre compte
            en cas de :
          </p>
          <ul>
            <li>Violation des présentes CGU</li>
            <li>Comportement inapproprié ou nuisible</li>
            <li>Utilisation frauduleuse du service</li>
            <li>Inactivité prolongée (plus de 2 ans)</li>
          </ul>
        </section>

        <section>
          <h2>8. Propriété intellectuelle</h2>
          <p>
            L'ensemble du contenu du site (design, code, logo, textes, etc.) est
            la propriété exclusive de Joss Filippi, sauf mention contraire.
          </p>
          <p>
            Toute reproduction, distribution ou utilisation sans autorisation
            est interdite.
          </p>
        </section>

        <section>
          <h2>9. Protection des données personnelles</h2>
          <p>
            Vos données personnelles sont traitées conformément à notre{" "}
            <Link to="/privacy">Politique de confidentialité</Link> et au RGPD.
          </p>
          <p>Vous disposez notamment des droits suivants :</p>
          <ul>
            <li>Droit d'accès à vos données</li>
            <li>Droit de rectification</li>
            <li>Droit à l'effacement (droit à l'oubli)</li>
            <li>Droit à la portabilité</li>
            <li>Droit d'opposition</li>
          </ul>
        </section>

        <section>
          <h2>10. Limitation de responsabilité</h2>

          <h3>10.1 Service fourni "en l'état"</h3>
          <p>
            BirthReminder est fourni "en l'état" sans garantie d'aucune sorte,
            expresse ou implicite. Nous ne garantissons pas que le service sera
            exempt d'erreurs ou disponible en permanence.
          </p>

          <h3>10.2 Limitation de responsabilité</h3>
          <p>
            Dans les limites autorisées par la loi, BirthReminder ne pourra être
            tenu responsable :
          </p>
          <ul>
            <li>Des dommages indirects ou consécutifs</li>
            <li>De la perte de données ou de profits</li>
            <li>Des interruptions de service</li>
            <li>Du contenu créé par d'autres utilisateurs</li>
          </ul>

          <h3>10.3 Oubli d'anniversaire</h3>
          <p className="note">
            💡 BirthReminder est un outil de rappel, mais nous ne pouvons
            garantir la réception des emails à 100%. Nous vous encourageons à
            vérifier régulièrement vos dates importantes.
          </p>
        </section>

        <section>
          <h2>11. Droit applicable et juridiction</h2>
          <p>
            Les présentes CGU sont soumises au droit français. En cas de litige,
            et à défaut de résolution amiable, les tribunaux français seront
            seuls compétents.
          </p>
          <p>
            Conformément à l'article L.612-1 du Code de la consommation, vous
            pouvez recourir gratuitement à un médiateur de la consommation en
            cas de litige.
          </p>
        </section>

        <section>
          <h2>12. Modifications des CGU</h2>
          <p>
            Nous pouvons modifier ces CGU à tout moment. Les modifications
            importantes vous seront notifiées par email et/ou via une
            notification sur le site.
          </p>
          <p>
            En continuant à utiliser le service après modification des CGU, vous
            acceptez les nouvelles conditions.
          </p>
        </section>

        <section>
          <h2>13. Contact</h2>
          <p>Pour toute question concernant ces CGU, contactez-nous :</p>
          <ul>
            <li>
              <strong>Email :</strong>{" "}
              <a href="mailto:contact@birthreminder.com">
                contact@birthreminder.com
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
