import { useState, useEffect } from "react";
import apiHandler from "../../api/apiHandler";
import "./css/friendWishlist.css";

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
      // Récupérer la wishlist de l'ami
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
      <div className="friend-wishlist-modal">
        <div className="friend-wishlist-content">
          <div className="loading">Chargement...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="friend-wishlist-modal" onClick={onClose}>
      <div
        className="friend-wishlist-content"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="friend-wishlist-header">
          <h2>🎁 Wishlist de {friendName}</h2>
          <button className="close-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="friend-wishlist-body">
          {error && <div className="error-message">{error}</div>}

          {wishlist.length === 0 ? (
            <div className="empty-wishlist">
              <p>🎈 {friendName} n'a pas encore d'idées de cadeaux</p>
            </div>
          ) : (
            <div className="wishlist-items">
              {wishlist.map((item) => (
                <div key={item._id} className="wishlist-item">
                  <div className="wishlist-item-header">
                    <h3>{item.title}</h3>
                    {item.price && (
                      <span className="wishlist-price">{item.price}€</span>
                    )}
                  </div>

                  {item.description && (
                    <p className="wishlist-description">{item.description}</p>
                  )}

                  {item.link && (
                    <a
                      href={item.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="wishlist-link"
                    >
                      🔗 Voir le produit
                    </a>
                  )}

                  {item.image && (
                    <img
                      src={item.image}
                      alt={item.title}
                      className="wishlist-image"
                    />
                  )}

                  <div className="wishlist-item-footer">
                    {item.priority && (
                      <span className={`priority priority-${item.priority}`}>
                        {item.priority === "high" && "🔥 Priorité haute"}
                        {item.priority === "medium" && "⭐ Priorité moyenne"}
                        {item.priority === "low" && "💡 Idée"}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="friend-wishlist-footer">
          <button className="btn-close" onClick={onClose}>
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};

export default FriendWishlist;
