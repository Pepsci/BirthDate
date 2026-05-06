import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import "./css/publicWishlist.css";

const API_URL =
  window.location.hostname === "localhost"
    ? "http://localhost:4000/api"
    : "https://birthreminder.com/api";

// ─── LocalStorage helpers ─────────────────────────────────
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
  // isVerified = le visiteur a entré le bon code ami
  // Si pas de code requis, isVerified = true d'emblée
  const [isVerified, setIsVerified] = useState(false);
  const [verifiedCode, setVerifiedCode] = useState("");
  const [myReservations, setMyReservations] = useState(() =>
    getMyReservations(publicSlug),
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reservingId, setReservingId] = useState(null);
  const [toast, setToast] = useState(null);

  // Modal code ami (affiché au moment de réserver, pas à l'entrée)
  const [showCodeModal, setShowCodeModal] = useState(false);
  const [codeInput, setCodeInput] = useState("");
  const [codeError, setCodeError] = useState("");

  // Modal nom visiteur
  const [showNameModal, setShowNameModal] = useState(false);
  const [guestName, setGuestName] = useState(
    () => localStorage.getItem("wishlist_guest_name") || "",
  );
  const [guestNameInput, setGuestNameInput] = useState("");
  const [pendingAction, setPendingAction] = useState(null);

  useEffect(() => {
    fetchWishlist();
    // Restaurer le code vérifié depuis la session
    const sessionCode = sessionStorage.getItem(`code_${publicSlug}`) || "";
    if (sessionCode) {
      setVerifiedCode(sessionCode);
      setIsVerified(true);
    }
    setMyReservations(getMyReservations(publicSlug));
  }, [publicSlug]);

  async function fetchWishlist() {
    try {
      setLoading(true);
      const res = await axios.get(`${API_URL}/wishlist/public/${publicSlug}`);
      setItems(res.data.items || []);
      setHasFriendCode(res.data.hasFriendCode || false);
      // Si pas de code requis → accès direct aux actions
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

  // ─── Vérification du code ami ─────────────────────────────
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
      setShowCodeModal(false);
      // Relancer l'action en attente
      if (pendingAction?.type === "reserve") {
        await doReserve(pendingAction.itemId, guestName || pendingAction.name);
      }
      setPendingAction(null);
    } catch (err) {
      setCodeError(err.response?.data?.message || "Code incorrect. Réessaie.");
    }
  }

  function showToast(message, type = "success") {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }

  // ─── Réservation ──────────────────────────────────────────
  async function handleReserve(itemId) {
    // Étape 1 : demander le nom si pas encore renseigné
    if (!guestName) {
      setPendingAction({ type: "reserve", itemId });
      setShowNameModal(true);
      return;
    }
    // Étape 2 : demander le code si requis et pas encore vérifié
    if (hasFriendCode && !isVerified) {
      setPendingAction({ type: "reserve", itemId });
      setShowCodeModal(true);
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
      saveMyReservation(publicSlug, itemId);
      setMyReservations(getMyReservations(publicSlug));
      showToast("Cadeau réservé ! 🎁");
      fetchWishlist();
    } catch (err) {
      if (err.response?.status === 409) {
        showToast("Ce cadeau est déjà réservé.", "error");
      } else if (err.response?.status === 401) {
        // Code expiré ou invalide → redemander
        setIsVerified(false);
        setPendingAction({ type: "reserve", itemId });
        setShowCodeModal(true);
      } else {
        showToast("Une erreur est survenue.", "error");
      }
    } finally {
      setReservingId(null);
    }
  }

  async function handleUnreserve(itemId) {
    setReservingId(itemId);
    try {
      await axios.post(
        `${API_URL}/wishlist/public/${publicSlug}/${itemId}/unreserve`,
        {
          friendCode: verifiedCode || undefined,
          guestName,
        },
      );
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

  // ─── Modal nom visiteur ───────────────────────────────────
  function handleNameSubmit(e) {
    e.preventDefault();
    if (!guestNameInput.trim()) return;
    const name = guestNameInput.trim();
    setGuestName(name);
    localStorage.setItem("wishlist_guest_name", name);
    setShowNameModal(false);

    if (pendingAction?.type === "reserve") {
      // Après le nom, vérifier si le code est encore requis
      if (hasFriendCode && !isVerified) {
        setPendingAction({ ...pendingAction, name });
        setShowCodeModal(true);
      } else {
        doReserve(pendingAction.itemId, name);
        setPendingAction(null);
      }
    }
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

  const visibleItems = (items || []).filter((item) => !item.isPurchased);

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
                  reservingId={reservingId}
                  isReservedByMe={myReservations.includes(item._id)}
                  onReserve={handleReserve}
                  onUnreserve={handleUnreserve}
                />
              ))}
            </div>
          </>
        )}

        <p className="pwl-affiliate-notice">
          En tant que Partenaire Amazon, BirthReminder réalise un bénéfice sur
          les achats remplissant les conditions requises.
        </p>
      </main>

      {/* ── Modal code ami (affiché au moment de réserver) ── */}
      {showCodeModal && (
        <div className="pwl-modal-overlay">
          <div className="pwl-modal">
            <h3>🔒 Code ami requis</h3>
            <p>Entre le code partagé par ton ami pour réserver ce cadeau.</p>
            <form onSubmit={handleVerifyCode}>
              <input
                type="text"
                value={codeInput}
                onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
                placeholder="CODE AMI"
                maxLength={6}
                autoFocus
                className="pwl-code-input pwl-code-input--modal"
              />
              {codeError && <p className="pwl-code-error">{codeError}</p>}
              <div className="pwl-modal-actions">
                <button
                  type="button"
                  className="pwl-modal-cancel"
                  onClick={() => {
                    setShowCodeModal(false);
                    setPendingAction(null);
                    setCodeError("");
                  }}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="pwl-modal-confirm"
                  disabled={!codeInput.trim()}
                >
                  Valider
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal nom visiteur ── */}
      {showNameModal && (
        <div className="pwl-modal-overlay">
          <div className="pwl-modal">
            <h3>Qui es-tu ?</h3>
            <p>
              Indique ton prénom pour que ton ami sache qui a réservé ce cadeau.
              <br />
              <small className="pwl-rgpd-notice">
                Ton prénom sera visible uniquement par le propriétaire de cette
                liste.
              </small>
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

      {/* ── Toast ── */}
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
      {/* Badge */}
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

        {/* Réservé par moi → annuler */}
        {item.isReserved && isReservedByMe && (
          <button
            className="pwl-btn pwl-btn--unreserve"
            onClick={() => onUnreserve(item._id)}
            disabled={isLoading}
          >
            {isLoading ? "…" : "Annuler ma réservation"}
          </button>
        )}
      </div>
    </article>
  );
}
