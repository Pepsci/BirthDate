import React from "react";
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
  return (
    <div className="wpl-settings">
      <div className="wpl-settings-header">
        <div className="wpl-settings-title">
          <span className="wpl-settings-icon">🔗</span>
          <div>
            <h4>Partage public</h4>
            <p>Rends ta liste accessible via un lien, sans compte requis.</p>
          </div>
        </div>

        <button
          className={`wpl-toggle ${settings.isPublic ? "wpl-toggle--on" : ""}`}
          onClick={onToggle}
          disabled={loading}
          title={
            settings.isPublic ? "Désactiver le partage" : "Activer le partage"
          }
        >
          <span className="wpl-toggle-thumb" />
        </button>
      </div>

      {/* Avertissement RGPD — uniquement avant la première activation */}
      {!settings.isPublic && !settings.publicSlug && (
        <p className="wpl-settings-notice">
          ⚠️ En activant cette option, ta liste de cadeaux partagés sera
          accessible à toute personne possédant le lien. Aucun nom ne sera
          affiché.
        </p>
      )}

      {/* Contenu affiché uniquement si public activé */}
      {settings.isPublic && settings.publicUrl && (
        <div className="wpl-settings-body">
          {/* URL publique */}
          <div className="wpl-url-row">
            <input
              type="text"
              value={settings.publicUrl}
              readOnly
              className="wpl-url-input"
            />
            <button className="wpl-copy-btn" onClick={onCopyUrl}>
              {copied ? "✓ Copié !" : "Copier"}
            </button>
          </div>

          {/* Code ami */}
          <div className="wpl-friendcode-section">
            <div className="wpl-friendcode-header">
              <span>🔒 Code ami</span>
              <span className="wpl-friendcode-hint">
                Optionnel — requis pour réserver un cadeau
              </span>
            </div>

            {settings.friendCode ? (
              <div className="wpl-friendcode-row">
                <span className="wpl-friendcode-value">
                  {settings.friendCode}
                </span>
                <button
                  className="wpl-friendcode-btn wpl-friendcode-btn--regen"
                  onClick={onGenerateFriendCode}
                  disabled={loading}
                >
                  Renouveler
                </button>
                <button
                  className="wpl-friendcode-btn wpl-friendcode-btn--remove"
                  onClick={onRemoveFriendCode}
                  disabled={loading}
                >
                  Supprimer
                </button>
              </div>
            ) : (
              <button
                className="wpl-friendcode-btn wpl-friendcode-btn--generate"
                onClick={onGenerateFriendCode}
                disabled={loading}
              >
                + Générer un code ami
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default WishlistPublicSettings;
