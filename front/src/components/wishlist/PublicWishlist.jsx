import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import "./css/PublicWishlist.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000/api";

// Clé localStorage pour les réservations de ce visiteur sur ce slug
function storageKey(slug) {
  return `pwl_reserved_${slug}`;
}

function getMyReservations(slug) {
  try {
    return JSON.parse(localStorage.getItem(storageKey(slug)) || "[]");
  } catch {
    return [];
  }
}

function saveMyReservation(slug, itemId) {
  const current = getMyReservations(slug);
  if (!current.includes(itemId)) {
    localStorage.setItem(
      storageKey(slug),
      JSON.stringify([...current, itemId]),
    );
  }
}

function removeMyReservation(slug, itemId) {
  const current = getMyReservations(slug);
  localStorage.setItem(
    storageKey(slug),
    JSON.stringify(current.filter((id) => id !== itemId)),
  );
}

export default function PublicWishlist() {
  const { publicSlug } = useParams();

  const [items, setItems] = useState([]);
  const [hasFriendCode, setHasFriendCode] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [verifiedCode, setVerifiedCode] = useState("");
  const [codeInput, setCodeInput] = useState("");
  const [codeError, setCodeError] = useState("");
  const [guestName, setGuestName] = useState(
    () => localStorage.getItem("wishlist_guest_name") || "",
  );
  const [guestNameInput, setGuestNameInput] = useState("");
  const [myReservations, setMyReservations] = useState(() =>
    getMyReservations(publicSlug),
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reservingId, setReservingId] = useState(null);
  const [toast, setToast] = useState(null);
  const [showNameModal, setShowNameModal] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);

  useEffect(() => {
    fetchWishlist();
    // Restaurer le code vérifié depuis la session
    const sessionCode = sessionStorage.getItem(`code_${publicSlug}`) || "";
    if (sessionCode) {
      setVerifiedCode(sessionCode);
      setIsVerified(true);
    }
    // Restaurer mes réservations
    setMyReservations(getMyReservations(publicSlug));
  }, [publicSlug]);

  async function fetchWishlist() {
    try {
      setLoading(true);
      const res = await axios.get(`${API_URL}/wishlist/public/${publicSlug}`);
      setItems(res.data.items);
      setHasFriendCode(res.data.hasFriendCode);
      if (!res.data.hasFriendCode) {
        setIsVerified(true);
      }
    } catch (err) {
      if (err.response?.status === 404) {
        setError(
          "Cette liste de cadeaux n'existe pas ou n'est plus disponible.",
        );
      } else {
        setError("Une erreur est survenue. Réessaie plus tard.");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyCode(e) {
    e.preventDefault();
    setCodeError("");
    try {
      await axios.post(`${API_URL}/wishlist/public/${publicSlug}/verify`, {
        friendCode: codeInput,
      });
      setVerifiedCode(codeInput);
      setIsVerified(true);
      sessionStorage.setItem(`code_${publicSlug}`, codeInput);
    } catch (err) {
      setCodeError(err.response?.data?.message || "Code incorrect. Réessaie.");
    }
  }

  function showToast(message, type = "success") {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }

  async function handleReserve(itemId) {
    if (!guestName) {
      setPendingAction({ type: "reserve", itemId });
      setShowNameModal(true);
      return;
    }
    await doReserve(itemId, guestName);
  }

  async function doReserve(itemId, name) {
    setReservingId(itemId);
    try {
      await axios.post(
        `${API_URL}/wishlist/public/${publicSlug}/${itemId}/reserve`,
        {
          friendCode: verifiedCode || undefined,
          guestName: name,
        },
      );
      // Mémoriser que CE visiteur a réservé cet item
      saveMyReservation(publicSlug, itemId);
      setMyReservations(getMyReservations(publicSlug));
      showToast("Cadeau réservé ! 🎁");
      fetchWishlist();
    } catch (err) {
      if (err.response?.status === 409) {
        showToast("Ce cadeau est déjà réservé.", "error");
      } else if (err.response?.status === 401) {
        showToast("Code ami invalide. Recharge la page.", "error");
      } else {
        showToast("Une erreur est survenue.", "error");
      }
    } finally {
      setReservingId(null);
    }
  }

  async function handleUnreserve(itemId) {
    if (!guestName) {
      setPendingAction({ type: "unreserve", itemId });
      setShowNameModal(true);
      return;
    }
    setReservingId(itemId);
    try {
      await axios.post(
        `${API_URL}/wishlist/public/${publicSlug}/${itemId}/unreserve`,
        {
          friendCode: verifiedCode || undefined,
          guestName,
        },
      );
      // Retirer la réservation du localStorage
      removeMyReservation(publicSlug, itemId);
      setMyReservations(getMyReservations(publicSlug));
      showToast("Réservation annulée.");
      fetchWishlist();
    } catch (err) {
      showToast(err.response?.data?.message || "Erreur.", "error");
    } finally {
      setReservingId(null);
    }
  }

  function handleNameSubmit(e) {
    e.preventDefault();
    if (!guestNameInput.trim()) return;
    const name = guestNameInput.trim();
    setGuestName(name);
    localStorage.setItem("wishlist_guest_name", name);
    setShowNameModal(false);
    if (pendingAction?.type === "reserve") {
      doReserve(pendingAction.itemId, name);
    } else if (pendingAction?.type === "unreserve") {
      handleUnreserve(pendingAction.itemId);
    }
    setPendingAction(null);
  }

  // ─── Render ───────────────────────────────────────────────

  if (loading) {
    return (
      <div className="pwl-loading">
        <div className="pwl-spinner" />
        <p>Chargement de la liste…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="pwl-error-page">
        <span className="pwl-error-icon">🎁</span>
        <p>{error}</p>
      </div>
    );
  }

  // Filtrer les items achetés — ils n'ont plus lieu d'être affichés
  const visibleItems = items.filter((item) => !item.isPurchased);

  return (
    <div className="pwl-page">
      <header className="pwl-header">
        <div className="pwl-header-inner">
          <a href="https://birthreminder.com" className="pwl-logo">
            🎂 BirthReminder
          </a>
          <p className="pwl-tagline">Liste de cadeaux partagée</p>
        </div>
      </header>

      <main className="pwl-main">
        {/* Code gate */}
        {hasFriendCode && !isVerified ? (
          <div className="pwl-code-gate">
            <div className="pwl-code-card">
              <span className="pwl-code-icon">🔒</span>
              <h2>Liste privée</h2>
              <p>Entre le code partagé par ton ami pour accéder aux cadeaux.</p>
              <form onSubmit={handleVerifyCode} className="pwl-code-form">
                <input
                  type="text"
                  value={codeInput}
                  onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
                  placeholder="CODE AMI"
                  maxLength={6}
                  className="pwl-code-input"
                  autoFocus
                />
                {codeError && <p className="pwl-code-error">{codeError}</p>}
                <button type="submit" className="pwl-code-btn">
                  Accéder à la liste
                </button>
              </form>
            </div>
          </div>
        ) : (
          <>
            {visibleItems.length === 0 ? (
              <div className="pwl-empty">
                <span>🎁</span>
                <p>Aucun cadeau disponible pour l'instant.</p>
              </div>
            ) : (
              <>
                <p className="pwl-count">
                  {visibleItems.length} idée{visibleItems.length > 1 ? "s" : ""}{" "}
                  cadeau
                </p>
                <div className="pwl-grid">
                  {visibleItems.map((item) => (
                    <WishlistCard
                      key={item._id}
                      item={item}
                      isVerified={isVerified}
                      reservingId={reservingId}
                      // Est-ce que CE visiteur a réservé cet item ?
                      isReservedByMe={myReservations.includes(item._id)}
                      onReserve={handleReserve}
                      onUnreserve={handleUnreserve}
                    />
                  ))}
                </div>
              </>
            )}

            <p className="pwl-affiliate-notice">
              En tant que Partenaire Amazon, BirthReminder réalise un bénéfice
              sur les achats remplissant les conditions requises.
            </p>
          </>
        )}
      </main>

      {/* Modal nom visiteur */}
      {showNameModal && (
        <div className="pwl-modal-overlay">
          <div className="pwl-modal">
            <h3>Qui es-tu ?</h3>
            <p>
              Indique ton prénom pour que ton ami sache qui a réservé ce cadeau.
            </p>
            <form onSubmit={handleNameSubmit}>
              <input
                type="text"
                value={guestNameInput}
                onChange={(e) => setGuestNameInput(e.target.value)}
                placeholder="Ton prénom"
                maxLength={30}
                autoFocus
                className="pwl-name-input"
              />
              <div className="pwl-modal-actions">
                <button
                  type="button"
                  className="pwl-modal-cancel"
                  onClick={() => {
                    setShowNameModal(false);
                    setPendingAction(null);
                  }}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="pwl-modal-confirm"
                  disabled={!guestNameInput.trim()}
                >
                  Continuer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={`pwl-toast pwl-toast--${toast.type}`}>
          {toast.message}
        </div>
      )}
    </div>
  );
}

// ─── Carte cadeau ─────────────────────────────────────────

function WishlistCard({
  item,
  isVerified,
  reservingId,
  isReservedByMe,
  onReserve,
  onUnreserve,
}) {
  const isLoading = reservingId === item._id;

  return (
    <article
      className={`pwl-card ${item.isReserved ? "pwl-card--reserved" : ""}`}
    >
      {/* Badge — réservé par quelqu'un */}
      {item.isReserved && !isReservedByMe && (
        <span className="pwl-badge pwl-badge--reserved">Réservé</span>
      )}
      {isReservedByMe && (
        <span className="pwl-badge pwl-badge--mine">✓ Réservé par toi</span>
      )}

      {/* Image */}
      <div className="pwl-card-img-wrap">
        {item.image ? (
          <img
            src={item.image}
            alt={item.title}
            className="pwl-card-img"
            loading="lazy"
          />
        ) : (
          <div className="pwl-card-img-placeholder">🎁</div>
        )}
      </div>

      {/* Contenu */}
      <div className="pwl-card-body">
        <h3 className="pwl-card-title">{item.title}</h3>
        {item.description && (
          <p className="pwl-card-desc">{item.description}</p>
        )}
        {item.price && (
          <p className="pwl-card-price">
            {Number(item.price).toLocaleString("fr-FR", {
              style: "currency",
              currency: "EUR",
            })}
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="pwl-card-footer">
        {item.url && (
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="pwl-btn pwl-btn--primary"
          >
            Voir le produit →
          </a>
        )}

        {isVerified && (
          <>
            {/* Pas encore réservé → bouton réserver */}
            {!item.isReserved && (
              <button
                className="pwl-btn pwl-btn--reserve"
                onClick={() => onReserve(item._id)}
                disabled={isLoading}
              >
                {isLoading ? "…" : "🎁 Je l'offre"}
              </button>
            )}

            {/* Réservé par MOI → bouton annuler */}
            {item.isReserved && isReservedByMe && (
              <button
                className="pwl-btn pwl-btn--unreserve"
                onClick={() => onUnreserve(item._id)}
                disabled={isLoading}
              >
                {isLoading ? "…" : "Annuler ma réservation"}
              </button>
            )}

            {/* Réservé par quelqu'un d'autre → rien */}
          </>
        )}
      </div>
    </article>
  );
}
