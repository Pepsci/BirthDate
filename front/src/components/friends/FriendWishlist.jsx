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
      setWishlist(response.data);
      setLoading(false);
    } catch (error) {
      console.error("Erreur chargement wishlist:", error);
      setError("Impossible de charger la wishlist");
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
              <p>🎈 {friendName} n'a pas encore d'idées de cadeaux partagées</p>
            </div>
          ) : (
            <div className="gift-items">
              {wishlist.map((item) => (
                <div key={item._id} className="gift-item-card">
                  <div className="gift-item-header">
                    <h4 className="gift-item-title">{item.title}</h4>
                    {item.isPurchased && (
                      <span className="gift-item-badge purchased">
                        ✅ Acheté
                      </span>
                    )}
                  </div>

                  {item.price && (
                    <p className="gift-item-price">{item.price} €</p>
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
