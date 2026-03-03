import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./LandingPage.css";
import Logo from "./Logo+nom-couleur.png";

// ─── Hook stats : public si non connecté, perso si connecté ──────────────
const useBirthdayStats = () => {
  const [stats, setStats] = useState(null); // null = chargement
  const [error, setError] = useState(false);
  const [isPersonal, setIsPersonal] = useState(false);

  useEffect(() => {
    // Toujours les stats globales sur la landing, connecté ou non
    const base =
      window.location.hostname === "localhost"
        ? "http://localhost:4000/api"
        : "https://birthreminder.com/api";

    fetch(`${base}/date/stats`)
      .then((r) => r.json())
      .then((data) => setStats(data))
      .catch((err) => {
        console.error("Erreur stats publiques:", err);
        setError(true);
        setStats({ today: 0, thisMonth: 0, thisYear: 0, totalUsers: 0 });
      });
  }, []);

  return { stats, error, isPersonal };
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

// ─── Feature card ────────────────────────────────────────────────────────
const Feature = ({ icon, title, desc }) => (
  <div className="lp-feature">
    <span className="lp-feature-icon">{icon}</span>
    <h3>{title}</h3>
    <p>{desc}</p>
  </div>
);

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

// ─── Main component ──────────────────────────────────────────────────────
const LandingPage = () => {
  const navigate = useNavigate();
  const { stats, error, isPersonal } = useBirthdayStats();
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setLoaded(true), 80);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className={`lp-root${loaded ? " lp-loaded" : ""}`}>
      <div className="lp-blob lp-blob-1" />
      <div className="lp-blob lp-blob-2" />

      <section className="lp-hero">
        <img className="lp-logo" src={Logo} alt="BirthReminder" />
        <div className="lp-hero-text">
          <p className="lp-tagline">
            Organisez vos rappels d'anniversaire en toute simplicité.
          </p>
          <div className="lp-cta-row">
            <button
              onClick={() => navigate("/register")}
              className="lp-btn-primary"
            >
              Créer un compte
            </button>
            <button onClick={() => navigate("/login")} className="lp-btn-ghost">
              Se connecter
            </button>
          </div>
        </div>
      </section>

      <section className="lp-stats">
        <p className="lp-stats-context">{"🌍 Sur toute la communauté"}</p>
        <div className="lp-stats-grid">
          <StatCard
            emoji="🎂"
            value={stats ? stats.today : null}
            label="Aujourd'hui"
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
            label="Utilisateurs inscrits"
          />
        </div>
      </section>

      {error && (
        <p className="lp-stats-error">
          Impossible de charger les stats pour le moment.
        </p>
      )}

      <section className="lp-features">
        <Feature
          icon="🔔"
          title="Rappels automatiques"
          desc="Reçois une notification par email avant chaque anniversaire. Plus jamais d'oubli."
        />
        <Feature
          icon="🎁"
          title="Listes de souhaits"
          desc="Partage ta liste de cadeaux avec tes amis et réserve les leurs en un clic."
        />
        <Feature
          icon="💬"
          title="Chat intégré"
          desc="Discute en direct avec tes amis pour organiser surprises et cadeaux groupés."
        />
        <Feature
          icon="🌙"
          title="Mode sombre"
          desc="Une interface soignée, de jour comme de nuit."
        />
      </section>

      <footer className="lp-footer">
        <p>© {new Date().getFullYear()} BirthReminder — Fait avec ❤️</p>
      </footer>
    </div>
  );
};

export default LandingPage;
