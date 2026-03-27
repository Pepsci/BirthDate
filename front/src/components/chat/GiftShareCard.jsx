import React, { useState } from "react";
import ImportGiftModal from "../events/ImportGiftModal";
import "./css/giftShareCard.css";

const OCCASION_EMOJI = {
  "Anniversaire": "🎂",
  "Noël": "🎄",
  "Saint-Valentin": "💝",
  "Fête des Mères": "💐",
  "Fête des Pères": "👔",
  "Mariage": "💍",
  "Naissance": "👶",
  "Diplôme": "🎓",
  "Crémaillère": "🏠",
  "Autre": "✨",
};

const getOccasionEmoji = (occasion) => OCCASION_EMOJI[occasion] || "🎁";

/**
 * GiftShareCard
 * Rendu inline dans ChatWindow pour les messages de type "gift_share".
 * Bouton "Sauvegarder" → ImportGiftModal en mode "save".
 *
 * Props :
 *   - message  : objet message avec message.metadata { personName, gifts[] }
 *   - isOwn    : booléen (côté droit si true)
 */
const GiftShareCard = ({ message, isOwn }) => {
  const [expanded, setExpanded] = useState(true);
  const [showSaveModal, setShowSaveModal] = useState(false);

  const { personName, gifts = [] } = message.metadata || {};
  const pendingGifts = gifts.filter((g) => !g.purchased);
  const purchasedGifts = gifts.filter((g) => g.purchased);

  return (
    <>
      <div className={`gsc-card ${isOwn ? "gsc-card--own" : "gsc-card--other"}`}>

        {/* ── Header cliquable (expand/collapse) ── */}
        <div className="gsc-header" onClick={() => setExpanded((v) => !v)}>
          <div className="gsc-header-left">
            <span className="gsc-header-icon">🎁</span>
            <div>
              <p className="gsc-label">Idées cadeaux</p>
              {personName && <p className="gsc-person">pour {personName}</p>}
            </div>
          </div>
          <div className="gsc-header-right">
            <span className="gsc-count">{gifts.length} idée{gifts.length > 1 ? "s" : ""}</span>
            <span className={`gsc-chevron ${expanded ? "gsc-chevron--open" : ""}`}>▾</span>
          </div>
        </div>

        {/* ── Liste dépliable ── */}
        {expanded && (
          <div className="gsc-body">
            {gifts.length === 0 ? (
              <p className="gsc-empty">Aucune idée dans cette carte.</p>
            ) : (
              <>
                {pendingGifts.length > 0 && (
                  <div className="gsc-section">
                    {pendingGifts.map((gift, i) => (
                      <div key={i} className="gsc-gift-row">
                        <span className="gsc-gift-emoji">{getOccasionEmoji(gift.occasion)}</span>
                        <div className="gsc-gift-info">
                          <span className="gsc-gift-name">{gift.giftName}</span>
                          {gift.occasion && (
                            <span className="gsc-gift-meta">
                              {gift.occasion}{gift.year ? ` · ${gift.year}` : ""}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {purchasedGifts.length > 0 && (
                  <div className="gsc-section gsc-section--purchased">
                    <p className="gsc-section-label">Déjà achetés</p>
                    {purchasedGifts.map((gift, i) => (
                      <div key={i} className="gsc-gift-row gsc-gift-row--purchased">
                        <span className="gsc-gift-emoji">✅</span>
                        <div className="gsc-gift-info">
                          <span className="gsc-gift-name">{gift.giftName}</span>
                          {gift.occasion && (
                            <span className="gsc-gift-meta">
                              {gift.occasion}{gift.year ? ` · ${gift.year}` : ""}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* ── Bouton sauvegarder — uniquement pour le destinataire ── */}
            {!isOwn && gifts.length > 0 && (
              <button
                className="gsc-save-btn"
                onClick={(e) => { e.stopPropagation(); setShowSaveModal(true); }}
              >
                💾 Sauvegarder sur une fiche
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Modal sauvegarde ── */}
      {showSaveModal && (
        <ImportGiftModal
          mode="save"
          gifts={gifts}
          onClose={() => setShowSaveModal(false)}
          onSaved={() => setShowSaveModal(false)}
        />
      )}
    </>
  );
};

export default GiftShareCard;