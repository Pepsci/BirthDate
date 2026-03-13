import { Link } from "react-router-dom";
import Logo from "../UI/Logo";
import "./css/guidePage.css";

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
        q: "Comment supprimer mon compte ?",
        a: "Dans ton profil → onglet Informations, tout en bas. La suppression est conforme au RGPD : tes données sont anonymisées sous 30 jours.",
      },
    ],
  },
];

export default function GuidePage() {
  return (
    <div className="guide-page">
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
