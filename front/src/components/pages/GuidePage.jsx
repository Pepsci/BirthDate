import { Link } from "react-router-dom";
import Logo from "../UI/Logo";
import "./css/guidePage.css";
import { Helmet } from 'react-helmet-async'

  
const SECTIONS = [
  {
    id: "dates",
    emoji: "🎂",
    title: "Ajouter une date",
    items: [
      {
        q: "Comment ajouter un anniversaire ?",
        a: "Depuis l'accueil, clique sur le bouton + pour créer une nouvelle date. Tu peux y renseigner un prénom, une date, et une relation (ami, famille, collègue…).",
      },
      {
        q: "Comment modifier ou supprimer une date ?",
        a: "Appuie sur une carte d'anniversaire dans la liste pour accéder aux options de modification ou de suppression.",
      },
      {
        q: "Les anniversaires de mes amis s'ajoutent-ils automatiquement ?",
        a: "Oui ! Dès qu'un ami accepte ta demande d'amitié, son anniversaire apparaît automatiquement dans ta liste avec un badge 👥.",
      },
    ],
  },
  {
    id: "friends",
    emoji: "👥",
    title: "Amis & demandes",
    items: [
      {
        q: "Comment ajouter un ami ?",
        a: "Clique sur ton nom en haut à droite pour ouvrir ton profil, puis va dans l'onglet Amis. Tu peux rechercher un utilisateur par email et lui envoyer une demande.",
      },
      {
        q: "Où voir mes demandes d'amis reçues ?",
        a: "Un badge rouge apparaît sur ton nom en haut à droite quand tu as des demandes en attente. Clique dessus puis va dans l'onglet Amis.",
      },
      {
        q: "Que se passe-t-il si je supprime un ami ?",
        a: "La date d'anniversaire liée à cet ami est retirée de ta liste, et la tienne de la sienne.",
      },
    ],
  },
  {
    id: "wishlist",
    emoji: "🎁",
    title: "Wishlist & cadeaux",
    items: [
      {
        q: "Comment créer ma liste de souhaits ?",
        a: "Dans ton profil (ton nom en haut à droite), va dans l'onglet Wishlist et ajoute tes envies avec un titre, une description et un lien optionnel.",
      },
      {
        q: "Comment voir la wishlist d'un ami ?",
        a: "Clique sur la carte d'anniversaire d'un ami, puis sur son profil. Si il a une wishlist, tu pourras la consulter.",
      },
      {
        q: "Puis-je réserver un cadeau discrètement ?",
        a: "Oui ! Quand tu réserves un cadeau dans la liste d'un ami, lui ne voit pas qui l'a pris. Il voit juste que l'article est réservé.",
      },
      {
        q: "Comment marquer un cadeau comme offert ?",
        a: 'Depuis la wishlist d\'un ami, clique sur le cadeau réservé et sélectionne "Marquer comme offert". Il sera conservé dans ton historique de cadeaux.',
      },
    ],
  },
  {
    id: "events",
    emoji: "🎉",
    title: "Événements",
    items: [
      {
        q: "Comment organiser un événement ?",
        a: "Depuis la carte d'une personne, clique sur « Organiser un événement », ou passe par l'onglet Événements. Tu choisis un titre, une date (fixe ou soumise au vote), un lieu, et tu invites tes amis.",
      },
      {
        q: "Comment inviter quelqu'un qui n'a pas de compte ?",
        a: "Chaque événement possède un lien public et un code d'accès à 6 caractères. Partage-les : la personne pourra rejoindre l'événement, répondre à l'invitation et voter, sans créer de compte.",
      },
      {
        q: "À quoi servent les votes ?",
        a: "Si tu hésites sur la date ou le lieu, propose plusieurs options : les invités votent, et tu confirmes ensuite le choix retenu.",
      },
    ],
  },
  {
    id: "cagnotte",
    emoji: "💶",
    title: "Cagnotte",
    items: [
      {
        q: "Comment fonctionne la cagnotte d'un événement ?",
        a: "En tant qu'organisateur, tu peux ouvrir une cagnotte pour financer un cadeau commun. Les invités contribuent par carte, et l'argent arrive directement sur ton compte : BirthReminder ne le détient jamais et ne prélève aucune commission.",
      },
      {
        q: "Que dois-je faire pour recevoir l'argent ?",
        a: "Tu crées un compte auprès de Stripe, notre prestataire de paiement, qui vérifie ton identité et tes coordonnées bancaires. C'est une obligation légale pour encaisser de l'argent, et cela protège aussi tes invités.",
      },
      {
        q: "Que se passe-t-il si l'événement est annulé ?",
        a: "L'organisateur est responsable de rembourser les participants. BirthReminder ne détenant pas les fonds, il ne peut pas procéder au remboursement à sa place. Ne contribue qu'à des cagnottes ouvertes par des personnes que tu connais.",
      },
      {
        q: "Puis-je collecter par virement plutôt que par carte ?",
        a: "Oui, en partageant ton RIB avec les invités. Attention : ces virements se font de banque à banque, en dehors de l'application. Aucune trace n'est conservée et rien ne pourra être prouvé en cas de désaccord.",
      },
      {
        q: "Puis-je contribuer sans que mon nom apparaisse ?",
        a: "Oui, une contribution peut être anonyme ou faite sous un pseudonyme, y compris vis-à-vis de l'organisateur.",
      },
    ],
  },
  {
    id: "chiffrement",
    emoji: "🔒",
    title: "Chiffrement des messages",
    items: [
      {
        q: "Mes messages sont-ils lisibles par BirthReminder ?",
        a: "Non. Tes messages sont chiffrés de bout en bout : seuls toi et ton correspondant possédez les clés permettant de les lire. Nos serveurs ne stockent que du texte chiffré.",
      },
      {
        q: "Qu'est-ce que le chiffrement maximum et la phrase de récupération ?",
        a: "Dans Profil → Chiffrement, tu peux activer le mode maximum. Il génère une phrase de 12 mots à noter et conserver en lieu sûr, hors de ton téléphone. Cette phrase permet de retrouver tes messages sur un nouvel appareil.",
      },
      {
        q: "Que se passe-t-il si j'oublie mon mot de passe ?",
        a: "En mode standard, ta clé est protégée par ton mot de passe : le réinitialiser rend définitivement illisibles tous les messages échangés jusque-là. En mode maximum, tu ressaisis ta phrase de 12 mots et tu retrouves l'ensemble de tes messages.",
      },
      {
        q: "Que se passe-t-il si je perds ma phrase de récupération ?",
        a: "Personne ne peut la retrouver à ta place, pas même nous : c'est ce qui garantit que tes messages sont illisibles par des tiers. Sans elle et sans ton mot de passe, les anciens messages sont perdus. Note-la dès son affichage.",
      },
    ],
  },
  {
    id: "partage",
    emoji: "📤",
    title: "Partage & liste commune",
    items: [
      {
        q: "Comment partager une carte anniversaire ?",
        a: "Depuis la fiche d'une personne, clique sur « Partager ». Ton ami reçoit dans le chat une carte contenant le prénom, la date de naissance et la fête. Tes idées cadeaux ne sont jamais transmises.",
      },
      {
        q: "Que peut faire la personne qui la reçoit ?",
        a: "Elle peut l'enregistrer dans ses propres anniversaires. Si la personne concernée a un compte, elle peut aussi lui envoyer une demande d'ami — qui devra être acceptée, comme n'importe quelle demande.",
      },
      {
        q: "À quoi sert une liste de cadeaux commune ?",
        a: "Elle permet à deux personnes de préparer ensemble les cadeaux d'un proche : vous voyez et modifiez la même liste, ce qui évite les doublons. Lance-la depuis la fiche de la personne, onglet Liste commune.",
      },
    ],
  },
  {
    id: "securite",
    emoji: "🛡️",
    title: "Sécurité & modération",
    items: [
      {
        q: "Comment signaler un message ou un utilisateur ?",
        a: "Appuie longuement sur un message, ou ouvre le profil de la personne, puis choisis Signaler et indique le motif. Notre équipe examine chaque signalement, en principe sous 72 heures.",
      },
      {
        q: "Que fait le blocage d'un utilisateur ?",
        a: "La personne bloquée ne peut plus t'envoyer de messages, de demandes d'ami ni d'invitations. Elle n'est pas informée du blocage. Tu peux revenir sur ta décision depuis Profil → Utilisateurs bloqués.",
      },
      {
        q: "Que se passe-t-il quand je supprime une conversation ?",
        a: "Elle disparaît de ta liste et les anciens messages ne s'affichent plus chez toi. Ton correspondant conserve sa copie : personne ne peut effacer des messages chez quelqu'un d'autre, en particulier s'ils servent de preuve après un signalement.",
      },
    ],
  },
  {
    id: "notifications",
    emoji: "🔔",
    title: "Notifications",
    items: [
      {
        q: "Comment activer les rappels par email ?",
        a: "Va dans ton profil → onglet Notifications → Email. Tu peux choisir d'être rappelé 30, 14, 7, 3, 1 jours avant ou le jour J.",
      },
      {
        q: "Comment activer les notifications push ?",
        a: "Va dans ton profil → onglet Notifications → Push. Clique sur Activer et accepte la permission dans ton navigateur.",
      },
      {
        q: "Les notifications push fonctionnent-elles sur iPhone ?",
        a: "Oui, mais uniquement si tu as installé BirthReminder sur ton écran d'accueil (PWA). Dans Safari, appuie sur Partager ⎙ puis \"Sur l'écran d'accueil\", puis ouvre l'app depuis l'icône et active les push.",
      },
      {
        q: "Puis-je couper les notifications d'un ami en particulier ?",
        a: 'Oui ! Dans les notifications d\'un message chat, tu peux cliquer sur "Couper les notifs" pour désactiver les notifications de cet ami sans désactiver le reste.',
      },
    ],
  },
  {
    id: "account",
    emoji: "⚙️",
    title: "Mon compte",
    items: [
      {
        q: "Comment modifier mes informations personnelles ?",
        a: "Clique sur ton nom en haut à droite → onglet Informations. Tu peux modifier ton prénom, nom, date de naissance et avatar.",
      },
      {
        q: "Comment changer mon mot de passe ?",
        a: "Dans ton profil → onglet Informations, tu trouveras une section pour modifier ton mot de passe. Tu devras saisir ton mot de passe actuel pour confirmer.",
      },
      {
        q: "Comment récupérer une copie de mes données ?",
        a: "Dans ton profil → onglet Informations, clique sur « Télécharger mes données ». Tu obtiens un fichier contenant ton profil, tes dates, tes amis, tes cadeaux, tes événements et tes conversations. Tes messages étant chiffrés, ils sont déchiffrés par ton appareil au moment de l'export.",
      },
      {
        q: "Comment supprimer mon compte ?",
        a: "Dans ton profil → onglet Informations, tout en bas. La suppression est conforme au RGPD : tes données sont anonymisées sous 30 jours.",
      },
      {
        q: "Qu'advient-il de mes conversations si je supprime mon compte ?",
        a: "Elles sont retirées de ton côté, mais tes correspondants gardent leur copie des échanges : on ne peut pas effacer des messages chez autrui. Tes messages y apparaîtront sous la mention « Utilisateur supprimé ».",
      },
    ],
  },
];

export default function GuidePage() {
  return (
    <div className="guide-page">
      <Helmet>
          <title>Guide d'utilisation – BirthReminder</title>
          <meta name="description" content="Apprenez à utiliser BirthReminder : ajouter des anniversaires, gérer vos amis, configurer vos rappels email et push, créer votre wishlist." />
          <link rel="canonical" href="https://birthreminder.com/guide" />
      </Helmet>
      {/* Header */}
      <div className="guide-header">
        <Link to="/home" className="guide-back">
          ← Retour
        </Link>
        <Logo className="guide-logo" />
      </div>

      {/* Hero */}
      <div className="guide-hero">
        <div className="guide-hero-emoji">📖</div>
        <h1 className="guide-hero-title">Guide d'utilisation</h1>
        <p className="guide-hero-desc">
          Tout ce qu'il faut savoir pour ne plus jamais rater un anniversaire.
        </p>
        {/* Nav rapide */}
        <div className="guide-nav">
          {SECTIONS.map((s) => (
            <a key={s.id} href={`#${s.id}`} className="guide-nav-pill">
              {s.emoji} {s.title}
            </a>
          ))}
        </div>
      </div>

      {/* Sections */}
      <div className="guide-content">
        {SECTIONS.map((section) => (
          <section key={section.id} id={section.id} className="guide-section">
            <div className="guide-section-header">
              <span className="guide-section-emoji">{section.emoji}</span>
              <h2 className="guide-section-title">{section.title}</h2>
            </div>

            <div className="guide-items">
              {section.items.map((item, i) => (
                <div key={i} className="guide-item">
                  <div className="guide-item-q">
                    <span className="guide-item-icon">?</span>
                    <p>{item.q}</p>
                  </div>
                  <div className="guide-item-a">
                    <span className="guide-item-icon guide-item-icon--a">
                      →
                    </span>
                    <p>{item.a}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>

      {/* Footer CTA */}
      <div className="guide-footer-cta">
        <p>Une question non répondue ?</p>
        <a href="mailto:support@birthreminder.com" className="guide-cta-btn">
          Contacter le support
        </a>
        <Link to="/home" className="guide-cta-link">
          ← Retour à l'accueil
        </Link>
      </div>
    </div>
  );
}
