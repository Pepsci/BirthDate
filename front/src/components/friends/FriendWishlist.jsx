import { useState, useEffect } from "react";
import apiHandler from "../../api/apiHandler";
import "../UI/css/gifts-common.css";

const FriendWishlist = ({ friendUserId, friendName, onClose }) => {
  const [wishlist, setWishlist] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadFriendWishlist();
  }, [friendUserId]);

  const loadFriendWishlist = async () => {
    try {
      setLoading(true);
      const response = await apiHandler.get(`/wishlist/user/${friendUserId}`);

      // Fix bug : la réponse est { success, count, user, data: [...] }
      const items = response.data?.data || response.data || [];
      const publicItems = items.filter((item) => item.isShared === true);
      setWishlist(publicItems);
    } catch (error) {
      console.error("Erreur chargement wishlist:", error);
      setError("Impossible de charger la wishlist");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="gift-modal" onClick={onClose}>
        <div
          className="gift-modal-content"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="loading">Chargement...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="gift-modal" onClick={onClose}>
      <div className="gift-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="gift-modal-header">
          <h2>🎁 Wishlist de {friendName}</h2>
          <button className="close-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="gift-modal-body">
          {error && <div className="error-message">{error}</div>}

          {wishlist.length === 0 ? (
            <div className="gift-empty">
              <p>🎈 {friendName} n'a pas encore d'idées partagées</p>
            </div>
          ) : (
            <div className="gift-items">
              {wishlist.map((item) => (
                <div
                  key={item._id}
                  className={`gift-item-card ${item.isPurchased ? "gift-item-card--purchased" : ""}`}
                >
                  <div className="gift-item-horizontal">
                    {/* Image à gauche */}
                    {item.image && (
                      <div className="gift-item-img-wrapper">
                        <img
                          src={item.image}
                          alt={item.title}
                          onError={(e) => {
                            e.target.parentElement.style.display = "none";
                          }}
                        />
                        {item.isPurchased && (
                          <div className="gift-item-img-overlay">✅</div>
                        )}
                      </div>
                    )}

                    {/* Infos à droite */}
                    <div className="gift-item-content">
                      <div className="gift-item-header">
                        <h4 className="gift-item-title">{item.title}</h4>
                        {item.isPurchased && (
                          <span className="gift-item-badge purchased">
                            ✅ Réservé
                          </span>
                        )}
                      </div>

                      {item.description && (
                        <p className="gift-item-description">
                          {item.description}
                        </p>
                      )}

                      <div className="gift-item-footer">
                        {item.price && (
                          <span className="gift-item-price">
                            {item.price} €
                          </span>
                        )}
                        {item.url && (
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="gift-item-link"
                          >
                            🔗 Voir le produit
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="gift-modal-footer">
          <button className="btn-close" onClick={onClose}>
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};

export default FriendWishlist;
