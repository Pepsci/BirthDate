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

// ─── Feature card ────────────────────────────────────────────────────────
const FeatureCard = ({ icon, colorClass, title, desc, tag }) => (
  <div className="lp-feat-card">
    <div className={`lp-feat-icon ${colorClass}`}>{icon}</div>
    <div className="lp-feat-body">
      <h3>{title}</h3>
      <p>{desc}</p>
      {tag && <span className="lp-feat-tag">{tag}</span>}
    </div>
  </div>
);

// ─── Step card ───────────────────────────────────────────────────────────
const Step = ({ num, colorClass, title, desc, isLast }) => (
  <div className="lp-step">
    <div className={`lp-step-num ${colorClass}`}>{num}</div>
    <h4>{title}</h4>
    <p>{desc}</p>
    {!isLast && <span className="lp-step-arrow">→</span>}
  </div>
);

// ─── Main component ──────────────────────────────────────────────────────
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
      <SEO />
      <div className="lp-blob lp-blob-1" />
      <div className="lp-blob lp-blob-2" />

      {/* ── HERO ── */}
      <section className="lp-hero">
        <img className="lp-logo" src={Logo} alt="BirthReminder" />
        <div className="lp-hero-content">
          <div className="lp-hero-badge">
            <span>🎂</span> BirthReminder · Beta
          </div>
          <p className="lp-tagline">
            Rappels automatiques des anniversaires, listes de cadeaux partagées, chat chiffré entre amis, 
            tout pour célébrer les gens qui comptent.
          </p>
          <div className="lp-cta-row">
            <button onClick={() => navigate("/signup")} className="lp-btn-primary">
              Créer un compte gratuit
            </button>
            <button onClick={() => navigate("/login")} className="lp-btn-ghost">
              Se connecter
            </button>
          </div>
        </div>
      </section>

      {/* ── STATS ── */}
      <section className="lp-stats">
        <p className="lp-stats-context">🌍 Sur toute la communauté</p>
        <div className="lp-stats-grid">
          <StatCard
            emoji="🎂"
            value={stats ? stats.today : null}
            label="Aujourd'hui"
            highlight
            badge={stats?.today > 0 ? "🔥" : null}
          />
          <StatCard emoji="📅" value={stats ? stats.thisMonth : null} label="Ce mois-ci" />
          <StatCard emoji="🗓️" value={stats ? stats.thisYear : null} label="Cette année" />
          <StatCard emoji="🎉" value={stats ? stats.totalUsers : null} label="Utilisateurs inscrits" />
        </div>
      </section>

      {error && (
        <p className="lp-stats-error">Impossible de charger les stats pour le moment.</p>
      )}

      <div className="lp-divider" />

      {/* ── HOW IT WORKS ── */}
      <section className="lp-how">
        <h2 className="lp-section-title">Comment ça marche</h2>
        <p className="lp-section-sub">Trois étapes, zéro oubli.</p>
        <div className="lp-steps">
          <Step
            num="1"
            colorClass="s-purple"
            title="Ajoute tes proches"
            desc="Crée des fiches amis avec leur date d'anniversaire, liste de souhaits et infos importantes."
          />
          <Step
            num="2"
            colorClass="s-orange"
            title="Reçois les rappels"
            desc="Un email automatique t'arrive avant chaque anniversaire avec un lien direct vers la fiche."
          />
          <Step
            num="3"
            colorClass="s-pink"
            title="Célèbre ensemble"
            desc="Organise et coordonne cadeaux et surprises via le chat intégré, chiffré de bout en bout."
            isLast
          />
        </div>
      </section>

      <div className="lp-divider" />

      {/* ── FEATURES ── */}
      <section className="lp-features-v2">
        <h2 className="lp-section-title">Tout ce dont vous avez besoin</h2>
        <p className="lp-section-sub">Un vrai produit, pas une simple liste de rappels.</p>
        <div className="lp-feat-grid">
          <FeatureCard
            icon="🔔"
            colorClass="fc-purple"
            title="Rappels automatiques"
            desc="Email avant chaque anniversaire. J-1, J-3, J-7  plus jamais d'oubli même pour les proches les plus occupés."
          />
          <FeatureCard
            icon="🎁"
            colorClass="fc-orange"
            title="Listes de souhaits"
            desc="Partage ta liste et réserve les cadeaux de tes amis en un clic. La surprise reste intacte grâce au mode secret."
          />
          <FeatureCard
            icon="💬"
            colorClass="fc-pink"
            title="Chat en temps réel"
            desc="Organise surprises et cadeaux groupés directement dans l'app."
            tag="🔒 Chiffrement bout-en-bout"
          />
          <FeatureCard
            icon="📅"
            colorClass="fc-teal"
            title="Agenda intégré"
            desc="Vue mensuelle et hebdomadaire. Événements et anniversaires réunis dans un seul calendrier."
          />
          <FeatureCard
            icon="🎉"
            colorClass="fc-blue"
            title="Gestion d'événements"
            desc="Crée des soirées et fêtes. Invitations, chat d'événement et organisation centralisés."
          />
          <FeatureCard
            icon="🌍"
            colorClass="fc-green"
            title="Prénoms du jour"
            desc="Sois le premier à souhaiter à tes amis leur fête."
          />
        </div>
      </section>

      {/* ── CTA FINAL ── */}
      <section className="lp-cta-final">
        <div className="lp-cta-card">
          <h2>Prêt à ne plus jamais oublier ?</h2>
          <p>Rejoins BirthReminder c'est gratuit, sans pub, et ça prend 30 secondes.</p>
          <button onClick={() => navigate("/signup")} className="lp-btn-primary lp-btn-lg">
            Créer mon compte gratuitement →
          </button>
          <p className="lp-cta-detail">
            Aucune carte bancaire · Sans publicité · Données chiffrées
          </p>
        </div>
      </section>

      <footer className="lp-footer">
        <p>
          © {new Date().getFullYear()} BirthReminder — Fait avec ❤️
          {" · "}
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
