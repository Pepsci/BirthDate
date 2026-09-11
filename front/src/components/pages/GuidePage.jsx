import { Link } from "react-router-dom";
import Logo from "../UI/Logo";
import "./css/guidePage.css";
import { Helmet } from 'react-helmet-async'

  
import { FAQ_SECTIONS as SECTIONS } from "../../data/faqData";

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
        <Link to="/contact" className="guide-cta-btn">
          Contacter le support
        </Link>
        <Link to="/home" className="guide-cta-link">
          ← Retour à l'accueil
        </Link>
      </div>
    </div>
  );
}
