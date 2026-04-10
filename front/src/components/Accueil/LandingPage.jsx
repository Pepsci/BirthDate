import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./LandingPage.css";
import Logo from "./Logo+nom-couleur.png";
import SEO from "../SEO";

// ─── Hook stats publiques ─────────────────────────────────────────────────
const useBirthdayStats = () => {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const base =
      window.location.hostname === "localhost"
        ? "http://localhost:4000/api"
        : "https://birthreminder.com/api";

    fetch(`${base}/date/stats`)
      .then((r) => r.json())
      .then((data) => setStats(data))
      .catch(() => {
        setError(true);
        setStats({ today: 0, thisMonth: 0, thisYear: 0, totalUsers: 0 });
      });
  }, []);

  return { stats, error };
};

// ─── Animated counter ────────────────────────────────────────────────────
const Counter = ({ target, duration = 1200 }) => {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!target) return;
    const steps = 40;
    const increment = target / steps;
    let current = 0;
    const interval = setInterval(() => {
      current += increment;
      if (current >= target) {
        setValue(target);
        clearInterval(interval);
      } else {
        setValue(Math.floor(current));
      }
    }, duration / steps);
    return () => clearInterval(interval);
  }, [target, duration]);

  return <span>{value}</span>;
};

// ─── Stat card ───────────────────────────────────────────────────────────
const StatCard = ({ emoji, value, label, highlight, badge }) => (
  <div className={`lp-stat-card${highlight ? " lp-stat-today" : ""}`}>
    <span className="lp-stat-emoji">{emoji}</span>
    <div className="lp-stat-number">
      {value === null ? (
        <span className="lp-stat-skeleton" />
      ) : (
        <Counter target={value} />
      )}
    </div>
    <div className="lp-stat-label">{label}</div>
    {badge && <span className="lp-stat-badge">{badge}</span>}
  </div>
);

// ─── Feature card (nouveau layout avec points) ───────────────────────────
const FeatureCard = ({ icon, colorClass, title, desc, tag, soon, points }) => (
  <div className={`lp-feat-card${soon ? " lp-feat-soon" : ""}`}>
    <div className={`lp-feat-icon ${colorClass}`}>{icon}</div>
    <div className="lp-feat-body">
      <h3>{title}</h3>
      <p>{desc}</p>
      {points && (
        <ul className="lp-feat-points">
          {points.map((p, i) => (
            <li key={i}>
              <span className="lp-feat-check">✓</span>
              {p}
            </li>
          ))}
        </ul>
      )}
      {tag && <span className="lp-feat-tag">{tag}</span>}
      {soon && (
        <span className="lp-feat-tag lp-feat-tag-soon">
          ⏳ En cours de développement
        </span>
      )}
    </div>
  </div>
);

// ─── Showcase section ────────────────────────────────────────────────────
const ShowcaseSection = ({
  imgSrc,
  imgAlt,
  reverse,
  badge,
  title,
  desc,
  points,
}) => (
  <div className={`lp-showcase${reverse ? " lp-showcase-reverse" : ""}`}>
    <div className="lp-showcase-img-wrap">
      <img
        src={imgSrc}
        alt={imgAlt}
        className="lp-showcase-img"
        loading="lazy"
      />
    </div>
    <div className="lp-showcase-text">
      {badge && <span className="lp-showcase-badge">{badge}</span>}
      <h2 className="lp-showcase-title">{title}</h2>
      <p className="lp-showcase-desc">{desc}</p>
      {points && (
        <ul className="lp-showcase-points">
          {points.map((p, i) => (
            <li key={i}>
              <span className="lp-showcase-dot">✓</span>
              {p}
            </li>
          ))}
        </ul>
      )}
    </div>
  </div>
);

// ─── Step ────────────────────────────────────────────────────────────────
const Step = ({ num, colorClass, title, desc, isLast }) => (
  <div className="lp-step">
    <div className={`lp-step-num ${colorClass}`}>{num}</div>
    <h4>{title}</h4>
    <p>{desc}</p>
    {!isLast && <span className="lp-step-arrow">→</span>}
  </div>
);

// ─── Main ────────────────────────────────────────────────────────────────
const LandingPage = () => {
  const navigate = useNavigate();
  const { stats, error } = useBirthdayStats();
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setLoaded(true), 80);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className={`lp-root${loaded ? " lp-loaded" : ""}`}>
      <SEO
        title="BirthReminder Rappels anniversaires, wishlist partagée et organisation d'événements entre amis"
        description="Ne ratez plus jamais un anniversaire. BirthReminder centralise vos rappels, listes de cadeaux partagées, organisation d'événements et chat entre amis tout au même endroit, gratuitement."
        keywords="rappel anniversaire, liste de souhaits partagée, organiser cadeau groupé, application wishlist, organiser surprise anniversaire, cagnotte cadeau amis, rappel fête prénom"
      />
      <div className="lp-blob lp-blob-1" />
      <div className="lp-blob lp-blob-2" />

      {/* ── HERO ── */}
      <section className="lp-hero">
        <img
          className="lp-logo"
          src={Logo}
          alt="BirthReminder application rappel anniversaire"
        />
        <div className="lp-hero-content">
          <div className="lp-hero-badge">
            <span>🎂</span> BirthReminder · Beta
          </div>
          <h1 className="lp-hero-h1">
            Rappels d'anniversaires, wishlist partagée
            <br className="lp-hero-br" /> et organisation d'événements entre
            amis
          </h1>
          <p className="lp-tagline">
            Fini les anniversaires oubliés. BirthReminder vous envoie des
            rappels automatiques, centralise les listes de cadeaux de vos
            proches, aide à organiser surprises et soirées, et coordonne les
            cadeaux groupés tout dans une seule appli, gratuite et sans pub.
          </p>
          <div className="lp-cta-row">
            <button
              onClick={() => navigate("/signup")}
              className="lp-btn-primary"
            >
              Créer un compte gratuit
            </button>
            <button onClick={() => navigate("/login")} className="lp-btn-ghost">
              Se connecter
            </button>
          </div>
        </div>
      </section>

      {/* ── STATS ── */}
      <section
        className="lp-stats"
        aria-label="Statistiques de la communauté BirthReminder"
      >
        <p className="lp-stats-context">🌍 Sur toute la communauté</p>
        <div className="lp-stats-grid">
          <StatCard
            emoji="🎂"
            value={stats ? stats.today : null}
            label="Anniversaires aujourd'hui"
            highlight
            badge={stats?.today > 0 ? "🔥" : null}
          />
          <StatCard
            emoji="📅"
            value={stats ? stats.thisMonth : null}
            label="Ce mois-ci"
          />
          <StatCard
            emoji="🗓️"
            value={stats ? stats.thisYear : null}
            label="Cette année"
          />
          <StatCard
            emoji="🎉"
            value={stats ? stats.totalUsers : null}
            label="Membres inscrits"
          />
        </div>
      </section>

      {error && (
        <p className="lp-stats-error">
          Impossible de charger les stats pour le moment.
        </p>
      )}

      {/* ── SHOWCASES ── */}
      <section className="lp-showcases">
        <ShowcaseSection
          imgSrc="/screenshots/home.png"
          imgAlt="Dashboard BirthReminder liste d'anniversaires avec compte à rebours"
          badge="🔔 Rappels automatiques"
          title="Tous vos anniversaires, toujours à portée"
          desc="Visualisez en temps réel les prochains anniversaires de vos proches avec un compte à rebours précis. Plus jamais d'oubli, même pour les dates les plus proches."
          points={[
            "Rappels email configurables J-1, J-7, J-14, J-30",
            "Notifications push sur mobile et desktop",
            "Fêtes du prénom incluses automatiquement",
            "Filtres par famille, amis, période",
          ]}
        />
        <ShowcaseSection
          imgSrc="/screenshots/profil-mobile.png"
          imgAlt="Fiche profil BirthReminder wishlist et idées cadeaux"
          reverse
          badge="🎁 Wishlist & Cadeaux"
          title="Gérez les cadeaux sans gâcher la surprise"
          desc="Chaque proche dispose d'une fiche complète avec sa liste de souhaits à remplir. Réservez un cadeau discrètement pour éviter les doublons, la personne ne voit jamais qui a réservé quoi."
          points={[
            "Wishlist partagée avec tous vos amis",
            "Réservation secrète anti-doublon",
            "Idées cadeaux avec prix, lien et image",
            "Coordination des cadeaux groupés via le chat",
          ]}
        />
        <ShowcaseSection
          imgSrc="/screenshots/timer.png"
          imgAlt="Compte à rebours BirthReminder jours, heures, minutes, secondes"
          badge="⏱️ Compte à rebours"
          title="Le temps qui reste, au détail près"
          desc="Chaque anniversaire affiche un compte à rebours en temps réel jours, heures, minutes, secondes. Un rappel visuel immédiat pour ne jamais être pris de court."
          points={[
            "Compte à rebours live sur chaque fiche",
            "Badge visuel pour les anniversaires du jour et de la semaine",
            "Vue agenda mensuelle et hebdomadaire",
            "Tri automatique par date la plus proche",
          ]}
        />
        <ShowcaseSection
          imgSrc="/screenshots/home-mobile.png"
          imgAlt="BirthReminder sur mobile application responsive"
          reverse
          badge="📱 Mobile-first"
          title="Avec vous partout, sur tous vos appareils"
          desc="BirthReminder est entièrement responsive et optimisé pour mobile. Consultez vos anniversaires, gérez vos cadeaux et organisez vos événements depuis votre téléphone, où que vous soyez."
          points={[
            "Interface fluide sur mobile, tablette et desktop",
            "Notifications push sur smartphone",
            "Aucune installation fonctionne dans le navigateur",
            "Mode hors-ligne en cours de développement",
          ]}
        />
      </section>

      <div className="lp-divider lp-divider-wide" />

      {/* ── HOW IT WORKS ── */}
      <section className="lp-how" aria-labelledby="lp-how-title">
        <h2 id="lp-how-title" className="lp-section-title">
          Comment ça marche
        </h2>
        <p className="lp-section-sub">Trois étapes, zéro oubli.</p>
        <div className="lp-steps">
          <Step
            num="1"
            colorClass="s-purple"
            title="Ajoute une date"
            desc="Crée une fiche pour chaque date d'anniversaire, fête ajoutée automatiquement ou manuellement si non présent dans la base de donnée."
          />
          <Step
            num="2"
            colorClass="s-orange"
            title="Reçois les rappels au bon moment"
            desc="Un email arrive automatiquement un jour avant et un le jour J, tu peux configurer plus de rappel si tu le souhaites."
          />
          <Step
            num="3"
            colorClass="s-pink"
            title="Fête, offre et organise ensemble"
            desc="Ajoute un ami, consulte sa wishlist, lance un événement surprise et coordonne les cadeaux groupés via le chat chiffré intégré."
            isLast
          />
        </div>
      </section>

      <div className="lp-divider lp-divider-wide" />

      {/* ── FEATURES GRID ── */}
      <section className="lp-features-v2" aria-labelledby="lp-features-title">
        <h2 id="lp-features-title" className="lp-section-title">
          Tout ce dont vous avez besoin
        </h2>
        <p className="lp-section-sub">
          Un vrai produit pensé pour les relations, pas juste une liste de
          rappels.
        </p>
        <div className="lp-feat-grid">
          <FeatureCard
            icon="🔔"
            colorClass="fc-purple"
            title="Rappels automatiques des anniversaires et fêtes"
            desc="Email ou notification Push de rappel avant chaque anniversaire et fête."
            points={[
              "Délais configurables par personne",
              "Notifications push sur mobile et desktop",
              "Fêtes du prénom incluses automatiquement",
            ]}
          />
          <FeatureCard
            icon="🎁"
            colorClass="fc-orange"
            title="Wishlist partagée entre amis"
            desc="Chaque utilisateur dispose d'une liste de souhaits partageable. Réservez un cadeau pour éviter les doublons la surprise reste intacte."
            points={[
              "Ajout avec prix, lien URL et image automatique",
              "Mode réservation secret anti-doublon",
              "Consultation depuis la fiche de chaque ami",
            ]}
          />
          <FeatureCard
            icon="💬"
            colorClass="fc-pink"
            title="Chat en temps réel chiffré"
            desc="Organisez surprises et cadeaux groupés directement dans l'application. Les conversations sont chiffrées de bout en bout."
            points={[
              "Messagerie directe entre amis",
              "Chat de groupe dédié à chaque événement",
              "Partage d'idées cadeaux par message",
            ]}
            tag="🔒 Chiffrement bout-en-bout"
          />
          <FeatureCard
            icon="📅"
            colorClass="fc-teal"
            title="Agenda anniversaires et événements"
            desc="Vue mensuelle et hebdomadaire pour visualiser tous les anniversaires, fêtes et événements de votre entourage d'un seul coup d'œil."
            points={[
              "Vue mois et semaine combinées",
              "Navigation rapide vers les fiches",
              "Événements et anniversaires réunis",
            ]}
          />
          <FeatureCard
            icon="🎉"
            colorClass="fc-blue"
            title="Organisation d'événements entre amis"
            desc="Créez une soirée ou un anniversaire surprise. Invitez par lien ou code, votez pour la date et le lieu, coordonnez les cadeaux en groupe."
            points={[
              "Vote date et lieu entre invités",
              "Invités externes sans compte BirthReminder",
              "Propositions de cadeaux groupés avec vote",
            ]}
          />
          {/* Cagnotte — pleine largeur, grisée */}
          <FeatureCard
            icon="💰"
            colorClass="fc-yellow"
            title="Cagnotte groupée pour les cadeaux"
            desc="Bientôt : créez une cagnotte entre amis pour financer ensemble un cadeau commun directement depuis BirthReminder."
            soon
          />
        </div>
      </section>

      {/* ── CTA FINAL ── */}
      <section className="lp-cta-final">
        <div className="lp-cta-card">
          <h2>Prêt à ne plus jamais oublier un anniversaire ?</h2>
          <p>
            Rejoignez BirthReminder gratuit, sans publicité, opérationnel en
            moins de deux minutes. Vos données sont chiffrées, votre vie privée
            est respectée.
          </p>
          <button
            onClick={() => navigate("/signup")}
            className="lp-btn-primary lp-btn-lg"
          >
            Créer mon compte gratuitement →
          </button>
          <p className="lp-cta-detail">
            Aucune carte bancaire · Sans publicité · Données chiffrées
          </p>
        </div>
      </section>

      <footer className="lp-footer">
        <p>
          © {new Date().getFullYear()} BirthReminder Fait avec ❤️{" · "}
          <span className="lp-footer-links">
            <a href="/mentions-legales">Mentions légales</a>
            {" · "}
            <a href="/confidentialite">Confidentialité</a>
          </span>
        </p>
      </footer>
    </div>
  );
};

export default LandingPage;
