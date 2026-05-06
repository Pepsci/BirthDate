import React, { useState } from "react";
import "./css/WishlistPublicSettings.css";

const WishlistPublicSettings = ({
  settings,
  loading,
  copied,
  onToggle,
  onCopyUrl,
  onGenerateFriendCode,
  onRemoveFriendCode,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);

  function handleCopyCode() {
    if (!settings.friendCode) return;
    navigator.clipboard.writeText(settings.friendCode);
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  }

  return (
    <div className="wps-wrapper">
      {/* ── Header accordéon ── */}
      <button
        className="wps-header"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
      >
        <div className="wps-header-left">
          <span className="wps-icon">🔗</span>
          <span className="wps-header-title">Partage public</span>
          {!isOpen && settings.isPublic && (
            <span className="wps-badge-active">Actif</span>
          )}
        </div>
        <span className={`wps-chevron ${isOpen ? "wps-chevron--open" : ""}`}>
          ▼
        </span>
      </button>

      {/* ── Contenu déplié ── */}
      {isOpen && (
        <div className="wps-body">
          {/* Ligne 1 — Partage public */}
          <div className="wps-row">
            <div className="wps-row-left">
              <span className="wps-icon">🔗</span>
              <div className="wps-row-text">
                <p className="wps-row-title">Partage public</p>
                <p className="wps-row-sub">
                  Liste accessible sans compte via lien uniquement
                </p>
              </div>
            </div>
            <div className="wps-row-right">
              {settings.isPublic && settings.publicUrl && (
                <button
                  className="wps-btn"
                  onClick={onCopyUrl}
                  disabled={loading}
                >
                  {copied ? "✓ Copié !" : "Copier le lien"}
                </button>
              )}
              <button
                className={`wps-toggle ${settings.isPublic ? "wps-toggle--on" : ""}`}
                onClick={onToggle}
                disabled={loading}
                aria-label={
                  settings.isPublic
                    ? "Désactiver le partage"
                    : "Activer le partage"
                }
              >
                <span className="wps-toggle-thumb" />
              </button>
            </div>
          </div>

          <div className="wps-divider" />

          {/* Ligne 2 — Code de réservation */}
          <div
            className={`wps-row ${!settings.isPublic ? "wps-row--disabled" : ""}`}
          >
            <div className="wps-row-left">
              <span className="wps-icon">🔒</span>
              <div className="wps-row-text">
                <p className="wps-row-title">Code de réservation</p>
                <p className="wps-row-sub">
                  Permet à vos amis de réserver un cadeau
                </p>
              </div>
            </div>
            <div className="wps-row-right">
              {settings.friendCode ? (
                <>
                  <button
                    className="wps-btn"
                    onClick={handleCopyCode}
                    disabled={loading || !settings.isPublic}
                  >
                    {codeCopied ? "✓ Copié !" : `Copier ${settings.friendCode}`}
                  </button>
                  <button
                    className="wps-btn wps-btn--icon"
                    onClick={onGenerateFriendCode}
                    disabled={loading || !settings.isPublic}
                    title="Renouveler le code"
                  >
                    ↻
                  </button>
                  <button
                    className={`wps-toggle wps-toggle--on`}
                    onClick={onRemoveFriendCode}
                    disabled={loading || !settings.isPublic}
                    aria-label="Désactiver le code"
                  >
                    <span className="wps-toggle-thumb" />
                  </button>
                </>
              ) : (
                <>
                  <button
                    className="wps-btn"
                    onClick={onGenerateFriendCode}
                    disabled={loading || !settings.isPublic}
                  >
                    Générer un code
                  </button>
                  <button
                    className="wps-toggle"
                    onClick={onGenerateFriendCode}
                    disabled={loading || !settings.isPublic}
                    aria-label="Activer le code"
                  >
                    <span className="wps-toggle-thumb" />
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Notice RGPD — uniquement avant première activation */}
          {!settings.isPublic && !settings.publicSlug && (
            <p className="wps-notice">
              ⚠️ En activant cette option, ta liste de cadeaux partagés sera
              accessible à toute personne possédant le lien. Aucun nom ne sera
              affiché.
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default WishlistPublicSettings;
