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
          <p>
            Sur l'application mobile, une partie du service est également
            utilisable sans compte (article 2.4).
          </p>
        </section>

        <section>
          <h2>2. Accès au service</h2>

          <h3>2.1 Création de compte</h3>
          <p>
            Pour utiliser l'ensemble du service BirthReminder, vous devez créer
            un compte en fournissant :
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
            Le service BirthReminder est réservé aux personnes âgées d'au moins{" "}
            <strong>15 ans</strong>, âge à partir duquel un mineur peut
            consentir seul au traitement de ses données pour un service en
            ligne en France.
          </p>
          <p>
            Aucun compte ne peut être créé pour une personne de moins de 15
            ans, y compris par un parent ou un tuteur en son nom. Les
            utilisateurs de 15 à 17 ans ont accès à l'ensemble du service, à
            l'exception de l'ouverture de cagnottes (article 5.2).
          </p>
          <p className="warning">
            ⚠️ Un compte dont il apparaît qu'il appartient à une personne de
            moins de 15 ans est supprimé.
          </p>

          <h4>Exactitude de la date de naissance</h4>
          <p>
            En créant votre compte, vous certifiez que la date de naissance que
            vous indiquez est exacte. Elle conditionne l'accès à certaines
            fonctionnalités, notamment les cagnottes, réservées aux personnes
            majeures (article 5.2).
          </p>
          <p>
            Toute modification ultérieure de la date de naissance est
            enregistrée. Lorsqu'elle fait passer un compte de mineur à majeur,
            l'ouverture d'une cagnotte n'est possible qu'après un délai de 30
            jours. Une fausse déclaration peut entraîner la suspension de
            l'accès aux cagnottes, voire du compte (article 7.2).
          </p>

          <h3>2.4 Utilisation sans compte (application mobile)</h3>
          <p>
            L'application mobile peut être utilisée sans créer de compte. Dans
            ce mode, les dates d'anniversaire, idées de cadeaux, photos et la
            liste de souhaits sont enregistrées <strong>uniquement sur
            l'appareil</strong> de l'utilisateur. Elles ne sont ni transmises
            à BirthReminder, ni hébergées sur ses serveurs.
          </p>
          <p>
            Ce mode ne comporte aucune condition d'âge, aucune donnée n'étant
            collectée. Les fonctionnalités qui supposent de relier plusieurs
            personnes (amis, chat, événements, listes communes, cagnottes,
            partage public, réservation de cadeaux) n'y sont pas disponibles,
            pas plus que l'accès depuis le site web ou la synchronisation
            entre appareils.
          </p>
          <p className="warning">
            ⚠️ BirthReminder n'ayant aucune copie de ces données, il ne peut
            pas les récupérer en cas de perte, de vol ou de réinitialisation
            de l'appareil, ou de suppression de l'application. Il appartient à
            l'utilisateur d'en faire des sauvegardes, à l'aide de la fonction
            d'export prévue à cet effet.
          </p>
          <p>
            L'utilisateur peut à tout moment créer un compte et y importer ses
            données ; les conditions de l'article 2.3 s'appliquent alors.
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
          <p className="warning">
            ⚠️ Seule une personne majeure (18 ans révolus) peut ouvrir une
            cagnotte ou proposer un moyen de paiement à ses invités (carte
            bancaire, RIB, PayPal, lien vers une cagnotte tenue sur un autre
            service). Un utilisateur de 15 à 17 ans peut utiliser toutes les
            autres fonctionnalités et participer aux cagnottes des autres. S'il
            apparaît qu'une cagnotte a été ouverte par un mineur, BirthReminder
            la gèle et désactive l'accès de son auteur aux cagnottes.
          </p>
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
            L'application met à sa disposition une fonction de remboursement
            (article 5.4). Elle facilite l'exécution de cette obligation, elle
            ne la transfère pas : le fait qu'un outil existe ne rend pas
            BirthReminder responsable des sommes, et le fait qu'il ne soit pas
            utilisé ne dispense pas l'organisateur de rembourser.
          </p>
          <p>
            En ouvrant une cagnotte, il crée <strong>son propre compte
            Stripe</strong> et se soumet aux vérifications d'identité exigées
            par la réglementation. Ce compte lui appartient : il y accède
            directement, y consulte ses encaissements et y gère ses
            coordonnées bancaires, comme il le ferait sur n'importe quelle
            autre plateforme. Il accepte à ce titre, en plus des présentes, les{" "}
            <a
              href="https://stripe.com/fr/legal/ssa"
              target="_blank"
              rel="noopener noreferrer"
            >
              conditions des services Stripe
            </a>{" "}
            et, le cas échéant, le{" "}
            <a
              href="https://stripe.com/fr/legal/connect-account"
              target="_blank"
              rel="noopener noreferrer"
            >
              contrat de compte Stripe Connect
            </a>
            . Ces documents restent accessibles depuis la page de gestion de la
            cagnotte.
          </p>
          <p>
            Ces conditions encadrent le compte de paiement, pas la cagnotte
            elle-même : <strong>elles ne prévoient aucune obligation de
            remboursement en cas d'annulation</strong>. Stripe y précise au
            contraire que le titulaire du compte est seul responsable des biens
            et services fournis à ses clients, et que les frais déjà prélevés
            ne sont pas restituables. Les obligations de l'organisateur envers
            les participants relèvent donc uniquement du présent article 5.
          </p>

          <h3>5.3 Responsabilité du participant</h3>
          <p>
            Contribuer à une cagnotte est un acte volontaire entre
            particuliers. Vous ne contribuez qu'auprès de personnes que vous
            connaissez et à qui vous faites confiance. Une contribution n'est
            pas l'achat d'un bien ou d'un service : le droit de rétractation
            applicable aux achats en ligne ne s'y applique pas.
          </p>
          <p>
            Vous ne pouvez pas annuler vous-même une contribution déjà versée :
            seul l'organisateur peut déclencher un remboursement, et quitter
            l'événement ne vous rembourse pas. Adressez-vous à lui.
          </p>
          <p>
            Les présentes conditions sont acceptées à la création du compte. Un
            participant qui contribue <strong>sans compte</strong>, depuis un
            lien d'invitation, les accepte explicitement avant le paiement : la
            case de confirmation affichée à cette étape vaut acceptation, et la
            date en est conservée avec la contribution.
          </p>

          <h3>5.4 Remboursement des contributions</h3>
          <p>
            L'organisateur peut rembourser une contribution, ou l'ensemble
            d'entre elles, depuis la page de l'événement. Le remboursement est
            exécuté <strong>sur son propre compte Stripe</strong> : nous
            transmettons l'ordre, nous ne déplaçons aucun fonds, et nous
            n'avons pas à nous substituer à lui s'il ne le fait pas.
          </p>
          <p>
            Nous disposons toutefois d'une capacité technique d'intervention
            sur les paiements encaissés via l'application.{" "}
            <strong>
              Nous n'arbitrons pas les désaccords et n'intervenons pas à la
              demande d'un participant mécontent
            </strong>{" "}
            : cette faculté est réservée à des situations exceptionnelles et
            documentées — fraude caractérisée, organisateur injoignable ou
            compte supprimé, décision d'une autorité compétente. Elle reste par
            ailleurs limitée par le solde disponible sur le compte de
            l'organisateur : une fois les sommes virées sur son compte
            bancaire, plus personne ne peut les rappeler à sa place.
          </p>
          <p>
            Le contributeur récupère <strong>l'intégralité</strong> de la somme
            versée. En revanche, Stripe ne restitue pas les frais prélevés sur
            la transaction d'origine : environ <strong>1,5 % du montant plus
            0,25 €</strong> par contribution restent à la charge de
            l'organisateur, en plus de la somme rendue. Ce coût lui est affiché
            avant qu'il ne confirme l'opération. Ces frais sont fixés par
            Stripe et peuvent évoluer indépendamment de nous.
          </p>
          <p>
            L'annulation d'un événement, comme le transfert du rôle
            d'organisateur, <strong>gèle la cagnotte</strong> : plus aucune
            contribution ne peut y être versée. Les sommes déjà collectées
            restent sur le compte Stripe de l'organisateur qui les a encaissées
            — elles ne suivent pas le transfert du rôle. Il lui appartient de
            les reverser au nouvel organisateur ou de les rembourser aux
            participants.
          </p>
          <p className="warning">
            ⚠️ Le remboursement est irréversible et ne peut pas être annulé
            depuis l'application. Le crédit effectif sur le compte du
            contributeur dépend ensuite de sa banque et peut prendre plusieurs
            jours ouvrés : ce délai ne dépend ni de BirthReminder ni de
            l'organisateur.
          </p>
          <p>
            Les contributions reçues par virement bancaire (article 5.6) ne
            peuvent pas être remboursées par l'application, qui n'en a aucune
            trace.
          </p>

          <h3>5.5 Litiges : que faire et dans quel ordre</h3>
          <p>
            Une cagnotte met en relation deux particuliers. Tout différend se
            règle donc <strong>entre le participant et l'organisateur</strong> :
            BirthReminder n'est pas partie à l'opération, n'arbitre pas ces
            litiges et ne peut reverser des sommes qu'il ne détient pas. Nous
            pouvons en revanche établir la réalité d'un paiement, et c'est
            souvent ce qui débloque la situation.
          </p>
          <p>
            Chaque contribution par carte donne lieu à l'envoi d'un reçu à son
            auteur, comportant le montant, la date, l'identité de
            l'organisateur qui l'a encaissée et la référence du paiement.{" "}
            <strong>Conservez ce message</strong> : c'est votre preuve, et la
            première pièce qu'on vous demandera à chaque étape ci-dessous.
          </p>
          <ol>
            <li>
              <strong>Adressez-vous à l'organisateur.</strong> Il est le seul à
              détenir les fonds et le seul à pouvoir déclencher le
              remboursement. Indiquez-lui la référence figurant sur votre reçu.
              La grande majorité des situations se règle ici.
            </li>
            <li>
              <strong>Écrivez-nous</strong> depuis la page contact si vous
              restez sans réponse. Nous ne trancherons pas le fond du
              désaccord, mais nous pouvons confirmer le paiement, vérifier que
              le compte de l'organisateur existe toujours et le relancer.
            </li>
            <li>
              <strong>Saisissez un conciliateur de justice</strong> si le
              désaccord persiste. Le recours est gratuit, il se demande auprès
              de la mairie ou du tribunal de proximité, et il constitue un{" "}
              <em>préalable obligatoire</em> avant toute action en justice pour
              les litiges inférieurs à 5 000 €. À noter : le médiateur de la
              consommation n'est pas compétent ici, puisqu'il suppose un litige
              entre un consommateur et un professionnel.
            </li>
            <li>
              <strong>Contestez le paiement auprès de votre banque</strong> en
              dernier recours. Sachez que cette démarche fait supporter à
              l'organisateur des frais de litige non remboursables, en plus du
              montant repris.
            </li>
            <li>
              <strong>Déposez plainte</strong> si vous estimez avoir été victime
              d'une escroquerie — événement inventé, organisateur disparu avec
              les fonds. Le dépôt de plainte en ligne pour escroquerie sur
              internet se fait via le dispositif THESEE, sur le site du
              ministère de l'Intérieur. Signalez-le-nous également : nous gelons
              la cagnotte concernée et coopérons avec les autorités.
            </li>
          </ol>
          <p>
            Pour les paiements par carte, nous conservons trace de chaque
            contribution : identité du contributeur, montant, date et référence
            du paiement. Ces éléments peuvent être communiqués aux personnes
            concernées ou aux autorités compétentes sur demande légitime.
          </p>

          <h3>5.6 Cagnotte par virement bancaire</h3>
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

          <h3>5.7 Cagnotte ouverte sur un autre service</h3>
          <p>
            L'organisateur peut, plutôt que d'utiliser la cagnotte intégrée,
            afficher sur la page de l'événement un lien vers une cagnotte
            ouverte chez un tiers (Leetchi, Lydia, Le Pot Commun ou tout autre
            service).
          </p>
          <p className="warning">
            ⚠️ Dans ce cas, BirthReminder n'affiche qu'un lien.{" "}
            <strong>
              La collecte se déroule entièrement en dehors de nos services
            </strong>{" "}
            : nous n'en connaissons ni les montants, ni les participants, nous
            n'envoyons aucun reçu, nous n'en conservons aucune trace et nous ne
            pouvons produire aucune preuve de versement. Aucun remboursement
            n'est possible depuis l'application, et ces contributions
            n'apparaissent pas dans votre historique.
          </p>
          <p>
            Votre participation est alors régie par les conditions du service
            concerné, auquel il vous appartient de vous reporter. Tout
            différend se règle avec l'organisateur ou avec ce service, et
            l'article 5.5 ne s'y applique pas : nous ne pouvons pas confirmer
            un paiement dont nous n'avons pas connaissance.
          </p>
          <p>
            L'affichage d'un tel lien ne vaut ni recommandation, ni vérification
            du service concerné, ni garantie quant à l'usage des sommes
            collectées. Le nom donné à la cagnotte est choisi par
            l'organisateur ; le domaine réel du lien est affiché à côté afin
            que vous puissiez vérifier vers où il vous conduit avant de
            cliquer. Nous retirons tout lien qui nous serait signalé comme
            frauduleux ou trompeur.
          </p>

          <h3>5.8 Gratuité du service</h3>
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
            <li>
              Fausse déclaration de date de naissance, notamment pour accéder
              aux cagnottes
            </li>
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
          <p>
            En utilisation sans compte (article 2.4), les rappels sont
            programmés par l'appareil lui-même, pour une période limitée : ils
            dépendent de ses réglages de notification et supposent d'ouvrir
            l'application régulièrement.
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
          <p>
            Pour toute question concernant ces conditions, utilisez le{" "}
            <a href="/contact">formulaire de contact</a>. Il est accessible avec
            ou sans compte, et il ouvre un suivi : votre demande n'est pas un
            simple email perdu dans une boîte, vous pouvez consulter les
            réponses et poursuivre l'échange.
          </p>
          <ul>
            <li>
              <strong>Formulaire :</strong>{" "}
              <a href="/contact">birthreminder.com/contact</a>
            </li>
            <li>
              <strong>Délai de réponse :</strong> sous 48 h maximum
            </li>
          </ul>
        </section>

        <p className="last-update">
          <strong>Dernière mise à jour :</strong> 22 septembre 2026
        </p>
      </div>
    </div>
  );
}
