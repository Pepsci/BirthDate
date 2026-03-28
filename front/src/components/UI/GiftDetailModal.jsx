import React, { useEffect } from "react";
import "./css/giftDetailModal.css";

/**
 * GiftDetailModal
 * Modal détail universel pour toutes les listes cadeaux.
 * Reçoit un item déjà normalisé par GiftCardGrid.normalize()
 * + les callbacks selon le contexte.
 *
 * Props :
 *   item        : objet normalisé { id, title, description, price, url, image,
 *                 badge, badgeLabel, occasion, year, isPurchased,
 *                 isReserved, isReservedByMe, reservedByName,
 *                 voteCount, hasVoted, isOwner, proposedBy, raw }
 *   type        : "wishlist" | "gifts" | "event"
 *   readOnly    : bool (vue ami)
 *   onClose     : () => void
 *   onEdit      : (raw) => void
 *   onDelete    : (id) => void
 *   onToggle    : (raw) => void   — toggle acheté / toggle sharing
 *   onReserve   : (id) => void
 *   onUnreserve : (id) => void
 *   onOffered   : (raw) => void
 *   onVote      : (id) => void
 */
const GiftDetailModal = ({
  item,
  type,
  readOnly = false,
  onClose,
  onEdit,
  onDelete,
  onToggle,
  onReserve,
  onUnreserve,
  onOffered,
  onVote,
}) => {
  // Fermer sur Escape
  useEffect(() => {
    const handler = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const OCCASION_EMOJI = {
    Anniversaire: "🎂",
    Noël: "🎄",
    "Saint-Valentin": "💝",
    "Fête des Mères": "💐",
    "Fête des Pères": "👔",
    Mariage: "💍",
    Naissance: "👶",
    Diplôme: "🎓",
    Crémaillère: "🏠",
    Autre: "✨",
    birthday: "🎂",
    christmas: "🎄",
    other: "✨",
  };
  const getOccasionEmoji = (o) => OCCASION_EMOJI[o] || "🎁";

  const handleEditClick = () => {
    onEdit?.(item.raw);
    onClose();
  };
  const handleDeleteClick = () => {
    onDelete?.(item.id);
    onClose();
  };
  const handleToggleClick = () => {
    onToggle?.(item.raw);
    onClose();
  };
  const handleReserveClick = () => {
    onReserve?.(item.id);
    onClose();
  };
  const handleUnreserveClick = () => {
    onUnreserve?.(item.id);
    onClose();
  };
  const handleOfferedClick = () => {
    onOffered?.(item.raw);
    onClose();
  };
  const handleVoteClick = () => {
    onVote?.(item.id);
  };

  return (
    <div
      className="gdm-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="gdm-modal">
        {/* ── Bouton fermer ── */}
        <button className="gdm-close" onClick={onClose} aria-label="Fermer">
          ✕
        </button>

        {/* ── Image ── */}
        <div className="gdm-img-wrapper">
          {item.image ? (
            <img
              src={item.image}
              alt={item.title}
              className="gdm-img"
              onError={(e) => {
                e.target.style.display = "none";
                e.target.nextSibling.style.display = "flex";
              }}
            />
          ) : null}
          <div
            className="gdm-img-placeholder"
            style={{ display: item.image ? "none" : "flex" }}
          >
            <span className="gdm-img-emoji">
              {type === "gifts" ? getOccasionEmoji(item.occasion) : "🎁"}
            </span>
          </div>

          {/* Badge statut sur l'image */}
          {item.badge && (
            <span className={`gdm-badge gdm-badge--${item.badge}`}>
              {item.badgeLabel}
            </span>
          )}
        </div>

        {/* ── Corps ── */}
        <div className="gdm-body">
          {/* Titre */}
          <p className="gdm-title">{item.title}</p>

          {/* Description (wishlist) */}
          {item.description && (
            <p className="gdm-description">{item.description}</p>
          )}

          {/* Occasion + année (gifts) */}
          {type === "gifts" && (item.occasion || item.year) && (
            <div className="gdm-meta-row">
              {item.occasion && (
                <span className="gdm-meta-chip">
                  {getOccasionEmoji(item.occasion)} {item.occasion}
                </span>
              )}
              {item.year && (
                <span className="gdm-meta-chip gdm-meta-chip--year">
                  {item.year}
                </span>
              )}
            </div>
          )}

          {/* Prix + lien */}
          <div className="gdm-info-row">
            {item.price && <span className="gdm-price">{item.price}</span>}
            {item.url && (
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="gdm-link"
              >
                🔗 Voir le produit
              </a>
            )}
          </div>

          {/* Proposé par (event) */}
          {type === "event" && item.proposedBy && (
            <p className="gdm-proposed-by">Proposé par {item.proposedBy}</p>
          )}

          {/* Réservé par (vue proprio wishlist) */}
          {type === "wishlist" && !readOnly && item.isReserved && (
            <p className="gdm-reserved-owner">
              🎁 Quelqu'un a réservé ce cadeau pour toi
            </p>
          )}

          {/* Réservé par (vue ami wishlist) */}
          {type === "wishlist" &&
            readOnly &&
            item.isReserved &&
            !item.isReservedByMe && (
              <p className="gdm-reserved-friend">
                🧑 Réservé par {item.reservedByName || "un ami"}
              </p>
            )}

          {/* ── Actions ── */}
          <div className="gdm-actions">
            {/* Wishlist — vue propriétaire */}
            {type === "wishlist" && !readOnly && !item.isReserved && (
              <>
                <button
                  className="gdm-btn gdm-btn--secondary"
                  onClick={handleToggleClick}
                >
                  {item.raw?.isShared ? "🔒 Rendre privé" : "🔓 Partager"}
                </button>
                <button
                  className="gdm-btn gdm-btn--primary"
                  onClick={handleEditClick}
                >
                  ✏️ Modifier
                </button>
                <button
                  className="gdm-btn gdm-btn--danger"
                  onClick={handleDeleteClick}
                >
                  🗑️ Supprimer
                </button>
              </>
            )}

            {/* Gifts — vue propriétaire */}
            {type === "gifts" && !readOnly && (
              <>
                <button
                  className="gdm-btn gdm-btn--secondary"
                  onClick={handleToggleClick}
                >
                  {item.isPurchased
                    ? "⭕ Marquer non acheté"
                    : "✅ Marquer acheté"}
                </button>
                <button
                  className="gdm-btn gdm-btn--primary"
                  onClick={handleEditClick}
                >
                  ✏️ Modifier
                </button>
                <button
                  className="gdm-btn gdm-btn--danger"
                  onClick={handleDeleteClick}
                >
                  🗑️ Supprimer
                </button>
              </>
            )}

            {/* Wishlist — vue ami */}
            {type === "wishlist" && readOnly && !item.isPurchased && (
              <>
                {!item.isReserved ? (
                  <>
                    <button
                      className="gdm-btn gdm-btn--primary"
                      onClick={handleReserveClick}
                    >
                      🎁 Je le réserve
                    </button>
                    <button
                      className="gdm-btn gdm-btn--secondary"
                      onClick={handleOfferedClick}
                    >
                      ✅ Je l'ai offert
                    </button>
                  </>
                ) : item.isReservedByMe ? (
                  <>
                    <button
                      className="gdm-btn gdm-btn--secondary"
                      onClick={handleUnreserveClick}
                    >
                      ↩️ Annuler ma réservation
                    </button>
                    <button
                      className="gdm-btn gdm-btn--secondary"
                      onClick={handleOfferedClick}
                    >
                      ✅ Je l'ai offert
                    </button>
                  </>
                ) : null}
              </>
            )}

            {/* Event — vote */}
            {type === "event" && (
              <>
                {item.isOwner && (
                  <button
                    className="gdm-btn gdm-btn--primary"
                    onClick={handleEditClick}
                  >
                    ✏️ Modifier
                  </button>
                )}
                <button
                  className={`gdm-btn gdm-btn--vote ${item.hasVoted ? "gdm-btn--voted" : ""}`}
                  onClick={handleVoteClick}
                >
                  {item.hasVoted ? "♥ Voté" : "♡ Voter"} · {item.voteCount}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default GiftDetailModal;
