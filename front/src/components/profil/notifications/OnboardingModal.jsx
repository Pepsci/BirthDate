import React, { useState, useEffect } from "react";
import axios from "axios";
import "../css/onboardingModal.css";

// Détection iPhone/iOS
const isIOS = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

const isPWA = () =>
  window.matchMedia("(display-mode: standalone)").matches ||
  window.navigator.standalone === true;

// ── Étapes de base ────────────────────────────────────────────────────────────
const BASE_STEPS = [
  {
    id: "welcome",
    emoji: "🎉",
    title: "Bienvenue sur BirthReminder !",
    description:
      "Ne rate plus jamais un anniversaire. Ce guide rapide t'explique comment tirer le meilleur de l'app.",
    highlight: null,
    tip: null,
    cta: "C'est parti !",
  },
  {
    id: "dates",
    emoji: "🎂",
    title: "Ajoute ta première date",
    description:
      "Clique sur le bouton  `Ajouter une date` pour ajouter un anniversaire, une fête ou tout événement important.",
    highlight: 'le bouton "Ajouter une date" dans la barre en haut de la liste',
    tip: "Les anniversaires de tes amis s'ajoutent automatiquement quand ils acceptent ta demande d'ami !",
    cta: "Compris !",
  },
  {
    id: "friends",
    emoji: "👥",
    title: "Amis & demandes",
    description:
      "Ajoute des amis pour voir leurs anniversaires et partager les tiens. Gère tes demandes depuis ton profil.",
    highlight:
      "ton nom en haut à droite — c'est un bouton qui ouvre ton profil !",
    tip: "Quand un ami accepte ta demande, son anniversaire est ajouté automatiquement à ta liste.",
    cta: "Super !",
  },
  {
    id: "wishlist",
    emoji: "🎁",
    title: "Wishlist & cadeaux",
    description:
      "Crée ta liste de souhaits et consulte celle de tes amis. Tu peux réserver un cadeau discrètement — l'ami ne verra pas qui l'a pris !",
    highlight: "la section Wishlist dans ton profil et celui d'un ami",
    tip: "Une fois le cadeau acheté, marque-le comme offert — il sera conservé dans ton historique de cadeaux dans l'onglet Idées.",
    cta: "Trop bien !",
  },
  {
    id: "notifications",
    emoji: "🔔",
    title: "Ne rate rien grâce aux notifications",
    description:
      "Configure tes rappels par email et active les notifications push pour recevoir des alertes même quand l'app est fermée.",
    highlight: "ton nom en haut à droite → onglet Notifications",
    tip: "Tu peux choisir la fréquence toi même",
    cta: "Parfait !",
  },
];

const IOS_STEP = {
  id: "pwa",
  emoji: "📱",
  title: "Installe l'app sur ton iPhone",
  description:
    "Pour recevoir les notifications push sur iPhone, ajoute BirthReminder à ton écran d'accueil.",
  highlight: null,
  tip: null,
  cta: "C'est fait !",
  isIOS: true,
};

export default function OnboardingModal({ onClose }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const [direction, setDirection] = useState("next");

  // Construire les étapes selon le device
  const steps = React.useMemo(() => {
    if (isIOS() && !isPWA()) {
      // Insérer l'étape PWA avant les notifications
      const s = [...BASE_STEPS];
      s.splice(4, 0, IOS_STEP);
      return s;
    }
    return BASE_STEPS;
  }, []);

  const total = steps.length;
  const step = steps[currentStep];
  const isLast = currentStep === total - 1;

  const goTo = (index, dir = "next") => {
    setDirection(dir);
    setLeaving(true);
    setTimeout(() => {
      setCurrentStep(index);
      setLeaving(false);
    }, 220);
  };

  const markDone = async () => {
    // Cache local immédiat pour éviter le re-flash
    localStorage.setItem("onboardingDone", "true");
    // Sauvegarde en DB (lié au compte, pas à l'appareil)
    try {
      await axios.patch("/api/users/me", { onboardingDone: true });
    } catch (err) {
      console.error("❌ Onboarding save error:", err);
    }
    onClose();
  };

  const handleNext = () => {
    if (isLast) {
      markDone();
    } else {
      goTo(currentStep + 1, "next");
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) goTo(currentStep - 1, "prev");
  };

  const handleFinish = () => markDone();
  const handleSkip = () => markDone();

  // Fermer sur Escape
  useEffect(() => {
    const handler = (e) => {
      if (e.key === "Escape") handleSkip();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <div
      className="onb-overlay"
      onClick={(e) => e.target === e.currentTarget && handleSkip()}
    >
      <div className="onb-modal">
        {/* Header */}
        <div className="onb-header">
          <div className="onb-steps-dots">
            {steps.map((_, i) => (
              <button
                key={i}
                className={`onb-dot ${i === currentStep ? "active" : ""} ${i < currentStep ? "done" : ""}`}
                onClick={() => goTo(i, i > currentStep ? "next" : "prev")}
                aria-label={`Étape ${i + 1}`}
              />
            ))}
          </div>
          <button className="onb-skip" onClick={handleSkip}>
            Passer et ne plus revoir
          </button>
        </div>

        {/* Contenu */}
        <div
          className={`onb-content ${leaving ? `leaving-${direction}` : "entering"}`}
        >
          {/* Emoji */}
          <div className="onb-emoji-wrap">
            <span className="onb-emoji">{step.emoji}</span>
            <div className="onb-emoji-ring" />
          </div>

          {/* Numéro étape */}
          <div className="onb-step-counter">
            Étape {currentStep + 1} sur {total}
          </div>

          {/* Texte */}
          <h2 className="onb-title">{step.title}</h2>
          <p className="onb-desc">{step.description}</p>

          {/* Highlight */}
          {step.highlight && (
            <div className="onb-highlight">
              <span className="onb-highlight-icon">👆</span>
              <span>
                Trouve ça sur <strong>{step.highlight}</strong>
              </span>
            </div>
          )}

          {/* Étape iOS spéciale */}
          {step.isIOS && (
            <div className="onb-ios-guide">
              <div className="onb-ios-step">
                <span className="onb-ios-num">1</span>
                <span>
                  Ouvre Safari et va sur <strong>birthreminder.com</strong>
                </span>
              </div>
              <div className="onb-ios-step">
                <span className="onb-ios-num">2</span>
                <span>
                  Appuie sur <strong>Partager</strong>{" "}
                  <span className="onb-ios-share">⎙</span>
                </span>
              </div>
              <div className="onb-ios-step">
                <span className="onb-ios-num">3</span>
                <span>
                  Sélectionne <strong>"Sur l'écran d'accueil"</strong>
                </span>
              </div>
              <div className="onb-ios-step">
                <span className="onb-ios-num">4</span>
                <span>
                  Ouvre l'app depuis l'icône et active les notifications
                </span>
              </div>
            </div>
          )}

          {/* Tip */}
          {step.tip && (
            <div className="onb-tip">
              <span className="onb-tip-icon">💡</span>
              <span>{step.tip}</span>
            </div>
          )}

          {/* Note info disponible partout (dernière étape) */}
          {isLast && (
            <div className="onb-info-note">
              <span>📖</span>
              <span>
                Retrouve ce guide à tout moment depuis le{" "}
                <strong>menu en bas de page</strong> → Guide d'utilisation.
              </span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="onb-footer">
          <button
            className="onb-btn-prev"
            onClick={handlePrev}
            disabled={currentStep === 0}
          >
            ← Précédent
          </button>

          <button className="onb-btn-next" onClick={handleNext}>
            {isLast ? "🎉 C'est parti !" : step.cta + " →"}
          </button>
        </div>

        {/* Barre de progression */}
        <div className="onb-progress-bar">
          <div
            className="onb-progress-fill"
            style={{ width: `${((currentStep + 1) / total) * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}
