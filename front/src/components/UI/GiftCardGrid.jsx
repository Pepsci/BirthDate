import React, { useState } from "react";
import "./css/giftCardGrid.css";
import GiftDetailModal from "./GiftDetailModal";

const GiftCardGrid = ({
  items = [],
  type = "wishlist",
  onEdit,
  onDelete,
  onToggle,
  onReserve,
  onUnreserve,
  onVote,
  onOffered,
  currentUserId,
  currentGuestName,
  isOrganizer = false,
  deletingId,
  onDeleteConfirm,
  onDeleteCancel,
  readOnly = false,
  showAddCard = false,
  onAdd,
}) => {
  const [selectedItem, setSelectedItem] = useState(null);

  const normalize = (item) => {
    if (type === "wishlist") {
      return {
        id: item._id,
        title: item.title,
        description: item.description,
        price: item.price,
        url: item.url,
        image: item.image,
        badge: item.isShared ? "shared" : "private",
        badgeLabel: item.isShared ? "🔓 Partagé" : "🔒 Privé",
        isReserved: !!item.reservedBy,
        isReservedByMe:
          item.reservedBy?._id?.toString() === currentUserId ||
          item.reservedBy?.toString() === currentUserId,
        isPurchased: item.isPurchased,
        reservedByName: item.reservedBy?.name
          ? `${item.reservedBy.name}${item.reservedBy.surname ? " " + item.reservedBy.surname : ""}`
          : null,
        raw: item,
      };
    }

    if (type === "gifts") {
      return {
        id: item._id,
        title: item.giftName,
        description: null,
        price: item.price ? `${item.price} €` : null,
        url: item.url || null,
        image: item.image || null,
        badge: item.purchased ? "purchased" : "pending",
        badgeLabel: item.purchased ? "✅ Acheté" : "⭕ À acheter",
        occasion: item.occasion,
        year: item.year,
        isPurchased: item.purchased,
        raw: item,
      };
    }

    if (type === "event") {
      const hasVoted = currentUserId
        ? item.votes
            ?.map((v) => v._id?.toString() || v.toString())
            .includes(currentUserId)
        : false;

      const isOwner = currentUserId
        ? item.proposedBy?._id?.toString() === currentUserId
        : currentGuestName
          ? item.guestName === currentGuestName
          : false;

      return {
        id: item._id,
        title: item.name,
        description: null,
        price: item.price ? `${item.price} €` : null,
        url: item.url,
        image: null,
        badge: null,
        voteCount: (item.votes?.length || 0) + (item.guestVotes?.length || 0),
        hasVoted,
        isOwner,
        proposedBy: item.proposedBy?.name || item.guestName,
        raw: item,
      };
    }

    return {
      id: item._id,
      title: item.name || item.title || item.giftName,
      raw: item,
    };
  };

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
  };
  const getOccasionEmoji = (occasion) => OCCASION_EMOJI[occasion] || "🎁";

  return (
    <div className="gcg-grid">
      {showAddCard && (
        <div className="gcg-card gcg-card--add" onClick={onAdd}>
          <div className="gcg-add-inner">
            <span className="gcg-add-icon">+</span>
            <span className="gcg-add-label">Ajouter</span>
          </div>
        </div>
      )}

      {items.map((rawItem) => {
        const item = normalize(rawItem);
        const isDeleting = deletingId === item.id;

        if (isDeleting) {
          return (
            <div key={item.id} className="gcg-card gcg-card--deleting">
              <div className="gift-delete-confirm">
                <div className="delete-confirm-icon">⚠️</div>
                <h4 className="delete-confirm-title">Supprimer ?</h4>
                <p className="delete-confirm-text">
                  <strong>{item.title}</strong>
                </p>
                <p className="delete-confirm-warning">
                  Cette action est irréversible
                </p>
                <div className="delete-confirm-buttons">
                  <button
                    className="btn-profil btn-profilGrey"
                    onClick={onDeleteCancel}
                  >
                    Annuler
                  </button>
                  <button
                    className="btn-profil btn-delete"
                    onClick={() => onDeleteConfirm(item.id)}
                  >
                    Supprimer
                  </button>
                </div>
              </div>
            </div>
          );
        }

        // Pour le type event : canEdit = owner, canDelete = owner OU organisateur
        const canEdit = type === "event" ? item.isOwner : true;
        const canDelete = type === "event" ? item.isOwner || isOrganizer : true;

        return (
          <div
            key={item.id}
            className={`gcg-card ${item.isPurchased && !readOnly ? "gcg-card--purchased" : ""} ${item.isReserved && readOnly && !item.isReservedByMe ? "gcg-card--reserved" : ""}`}
            onClick={() => setSelectedItem(item)}
            style={{ cursor: "pointer" }}
          >
            {/* ── Image / Placeholder ── */}
            <div className="gcg-img-wrapper">
              {item.image ? (
                <img
                  src={item.image}
                  alt={item.title}
                  className="gcg-img"
                  onError={(e) => {
                    e.target.style.display = "none";
                    e.target.nextSibling.style.display = "flex";
                  }}
                />
              ) : null}
              <div
                className="gcg-img-placeholder"
                style={{ display: item.image ? "none" : "flex" }}
              >
                <span className="gcg-img-emoji">
                  {type === "gifts" ? getOccasionEmoji(item.occasion) : "🎁"}
                </span>
              </div>

              {item.badge && (
                <span className={`gcg-badge gcg-badge--${item.badge}`}>
                  {item.badgeLabel}
                </span>
              )}

              {/* Overlay hover — pour event : edit seulement si owner, delete si owner ou organizer */}
              {!readOnly && (type !== "event" || canEdit || canDelete) && (
                <div className="gcg-hover-actions">
                  {onEdit && canEdit && type !== "event" && (
                    <button
                      className="gcg-action-btn gcg-action-btn--edit"
                      onClick={(e) => {
                        e.stopPropagation();
                        onEdit(rawItem);
                      }}
                    >
                      ✏️
                    </button>
                  )}
                  {onDelete && canDelete && (
                    <button
                      className="gcg-action-btn gcg-action-btn--delete"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(item.id);
                      }}
                    >
                      🗑️
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* ── Corps ── */}
            <div className="gcg-body">
              <div className="gcg-body-top">
                <h4 className="gcg-title">{item.title}</h4>
                {item.description && (
                  <p className="gcg-desc">{item.description}</p>
                )}
                {type === "gifts" && item.occasion && (
                  <p className="gcg-meta">
                    {getOccasionEmoji(item.occasion)} {item.occasion}
                    {item.year ? ` · ${item.year}` : ""}
                  </p>
                )}
                {type === "event" && item.proposedBy && (
                  <p className="gcg-meta">Proposé par {item.proposedBy}</p>
                )}
                {type === "wishlist" && !readOnly && item.isReserved && (
                  <p className="gcg-reserved-owner">
                    🎁 Quelqu'un a réservé ce cadeau pour toi
                  </p>
                )}
              </div>

              <div className="gcg-body-bottom">
                <div className="gcg-footer">
                  {item.price && (
                    <span className="gcg-price">
                      {item.price}
                      {type === "wishlist" ? " €" : ""}
                    </span>
                  )}
                  {item.url && (
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="gcg-link"
                      onClick={(e) => e.stopPropagation()}
                    >
                      🔗 Voir
                    </a>
                  )}
                </div>

                <div className="gcg-actions">
                  {type === "wishlist" && !readOnly && !item.isReserved && (
                    <>
                      <button
                        className="gcg-btn gcg-btn--secondary gcg-mobile-only"
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggle?.(rawItem);
                        }}
                      >
                        {rawItem.isShared ? "🔒" : "🔓"}
                      </button>
                      <button
                        className="gcg-btn gcg-btn--secondary gcg-mobile-only"
                        onClick={(e) => {
                          e.stopPropagation();
                          onEdit?.(rawItem);
                        }}
                      >
                        ✏️
                      </button>
                      <button
                        className="gcg-btn gcg-btn--danger gcg-mobile-only"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete?.(item.id);
                        }}
                      >
                        🗑️
                      </button>
                      <button
                        className="gcg-btn gcg-btn--ghost gcg-desktop-only"
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggle?.(rawItem);
                        }}
                      >
                        {rawItem.isShared ? "🔒 Rendre privé" : "🔓 Partager"}
                      </button>
                    </>
                  )}

                  {type === "gifts" && !readOnly && (
                    <>
                      <button
                        className="gcg-btn gcg-btn--secondary gcg-mobile-only"
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggle?.(rawItem);
                        }}
                      >
                        {rawItem.purchased ? "✅" : "⭕"}
                      </button>
                      <button
                        className="gcg-btn gcg-btn--secondary gcg-mobile-only"
                        onClick={(e) => {
                          e.stopPropagation();
                          onEdit?.(rawItem);
                        }}
                      >
                        ✏️
                      </button>
                      <button
                        className="gcg-btn gcg-btn--danger gcg-mobile-only"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete?.(item.id);
                        }}
                      >
                        🗑️
                      </button>
                      <button
                        className="gcg-btn gcg-btn--ghost gcg-desktop-only"
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggle?.(rawItem);
                        }}
                      >
                        {rawItem.purchased ? "⭕ Non acheté" : "✅ Acheté"}
                      </button>
                    </>
                  )}

                  {type === "wishlist" && readOnly && !item.isPurchased && (
                    <>
                      {!item.isReserved ? (
                        <>
                          <button
                            className="gcg-btn gcg-btn--primary"
                            onClick={(e) => {
                              e.stopPropagation();
                              onReserve?.(item.id);
                            }}
                          >
                            🎁 Je réserve
                          </button>
                          <button
                            className="gcg-btn gcg-btn--ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              onOffered?.(rawItem);
                            }}
                          >
                            ✅ Je l'ai offert
                          </button>
                        </>
                      ) : item.isReservedByMe ? (
                        <>
                          <button
                            className="gcg-btn gcg-btn--ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              onUnreserve?.(item.id);
                            }}
                          >
                            ↩️ Annuler
                          </button>
                          <button
                            className="gcg-btn gcg-btn--ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              onOffered?.(rawItem);
                            }}
                          >
                            ✅ Offert
                          </button>
                        </>
                      ) : (
                        <p className="gcg-reserved-friend">
                          🧑 Réservé par {item.reservedByName || "un ami"}
                        </p>
                      )}
                    </>
                  )}

                  {/* Pour event : edit dans gcg-vote-row (owner seulement), pas dans hover */}
                  {type === "event" && (
                    <div className="gcg-vote-row">
                      {item.isOwner && onEdit && (
                        <button
                          className="gcg-btn gcg-btn--ghost gcg-btn--sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            onEdit?.(rawItem);
                          }}
                          style={{ flex: "0 0 auto", padding: "6px 8px" }}
                        >
                          ✏️
                        </button>
                      )}
                      <button
                        className={`gcg-btn gcg-btn--vote ${item.hasVoted ? "gcg-btn--voted" : ""}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onVote?.(item.id);
                        }}
                      >
                        ♥ {item.voteCount}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}

      {selectedItem && (
        <GiftDetailModal
          item={selectedItem}
          type={type}
          readOnly={readOnly}
          onClose={() => setSelectedItem(null)}
          onEdit={(raw) => {
            setSelectedItem(null);
            onEdit?.(raw);
          }}
          onDelete={(id) => {
            setSelectedItem(null);
            onDelete?.(id);
          }}
          onToggle={(raw) => {
            onToggle?.(raw);
            setSelectedItem(null);
          }}
          onReserve={(id) => {
            onReserve?.(id);
            setSelectedItem(null);
          }}
          onUnreserve={(id) => {
            onUnreserve?.(id);
            setSelectedItem(null);
          }}
          onOffered={(raw) => {
            onOffered?.(raw);
            setSelectedItem(null);
          }}
          onVote={(id) => {
            onVote?.(id);
          }}
        />
      )}
    </div>
  );
};

export default GiftCardGrid;
