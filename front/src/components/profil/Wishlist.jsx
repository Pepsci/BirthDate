import React, { useState, useEffect } from "react";
import apiHandler from "../../api/apiHandler";
import useAuth from "../../context/useAuth";
import "../UI/css/gifts-common.css";

const Wishlist = () => {
  const { currentUser } = useAuth();
  const [wishlistItems, setWishlistItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [deletingItemId, setDeletingItemId] = useState(null);
  const [isFetchingUrl, setIsFetchingUrl] = useState(false);
  const [fetchMessage, setFetchMessage] = useState(null);

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    price: "",
    url: "",
    image: "",
    isShared: true,
  });

  const blockedDomains = [
    { domain: "amazon", name: "Amazon" },
    { domain: "fnac", name: "Fnac" },
    { domain: "micromania", name: "Micromania" },
  ];

  useEffect(() => {
    if (currentUser) fetchWishlist();
  }, [currentUser]);

  // Détection automatique sites bloqués dès la saisie URL
  useEffect(() => {
    if (!formData.url) {
      setFetchMessage(null);
      return;
    }
    const matched = blockedDomains.find((site) =>
      formData.url.toLowerCase().includes(site.domain),
    );
    if (matched) {
      setFetchMessage({
        type: "warning",
        text: `⚠️ ${matched.name} ne supporte pas le remplissage automatique — remplis les champs manuellement`,
      });
    } else {
      setFetchMessage((prev) =>
        prev?.text?.includes("ne supporte pas") ? null : prev,
      );
    }
  }, [formData.url]);

  const fetchWishlist = async () => {
    try {
      setIsLoading(true);
      const response = await apiHandler.get(
        `/wishlist?userId=${currentUser._id}`,
      );
      setWishlistItems(response.data.data || []);
    } catch (error) {
      console.error("Erreur lors du chargement de la wishlist:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({ ...formData, [name]: type === "checkbox" ? checked : value });
  };

  const handleFetchUrl = async () => {
    if (!formData.url.trim()) return;
    setIsFetchingUrl(true);
    setFetchMessage(null);
    try {
      const response = await apiHandler.post("/wishlist/fetch-url", {
        url: formData.url,
      });
      if (!response.data.success) {
        setFetchMessage({
          type: "warning",
          text: `⚠️ ${response.data.message || "Ce site ne permet pas la récupération automatique"}`,
        });
        return;
      }
      const { title, description, image, price } = response.data.data;
      setFormData((prev) => ({
        ...prev,
        title: title || prev.title,
        description: description || prev.description,
        image: image || prev.image,
        price: price || prev.price,
      }));
      const missing = [];
      if (!title) missing.push("titre");
      if (!price) missing.push("prix");
      if (!image) missing.push("image");
      setFetchMessage(
        missing.length === 0
          ? { type: "success", text: "✓ Infos récupérées !" }
          : {
              type: "warning",
              text: `⚠️ Remplissage partiel — ${missing.join(", ")} non trouvé${missing.length > 1 ? "s" : ""}`,
            },
      );
    } catch (error) {
      setFetchMessage({
        type: "warning",
        text: "⚠️ Erreur lors de la récupération",
      });
    } finally {
      setIsFetchingUrl(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      alert("Le titre est requis");
      return;
    }
    try {
      if (editingItem) {
        await apiHandler.patch(`/wishlist/${editingItem._id}`, formData);
      } else {
        await apiHandler.post("/wishlist", {
          ...formData,
          userId: currentUser._id,
        });
      }
      handleCancel();
      fetchWishlist();
    } catch (error) {
      console.error("Erreur lors de la sauvegarde:", error);
      alert("Erreur lors de la sauvegarde");
    }
  };

  const handleEdit = (item) => {
    setEditingItem(item);
    setFormData({
      title: item.title,
      description: item.description || "",
      price: item.price || "",
      url: item.url || "",
      image: item.image || "",
      isShared: item.isShared,
    });
    setFetchMessage(null);
    setShowForm(true);
    setDeletingItemId(null);
    setTimeout(() => {
      [
        document.querySelector(".gift-container"),
        document.querySelector(".mobile-carousel__content"),
        document.querySelector(".desktop-content"),
      ].forEach((el) => el?.scrollTo({ top: 0, behavior: "smooth" }));
    }, 100);
  };

  const handleDeleteClick = (itemId) => {
    setDeletingItemId(itemId);
    setShowForm(false);
    setEditingItem(null);
  };

  const handleConfirmDelete = async (itemId) => {
    try {
      await apiHandler.delete(`/wishlist/${itemId}`);
      setDeletingItemId(null);
      fetchWishlist();
    } catch (error) {
      console.error("Erreur lors de la suppression:", error);
      alert("Erreur lors de la suppression");
    }
  };

  const handleToggleSharing = async (item) => {
    try {
      await apiHandler.post(`/wishlist/${item._id}/toggle-sharing`);
      fetchWishlist();
    } catch (error) {
      console.error("Erreur lors du changement de partage:", error);
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingItem(null);
    setFetchMessage(null);
    setFormData({
      title: "",
      description: "",
      price: "",
      url: "",
      image: "",
      isShared: true,
    });
  };

  // Séparer items disponibles et réservés
  const availableItems = wishlistItems.filter((item) => !item.reservedBy);
  const reservedItems = wishlistItems.filter((item) => item.reservedBy);

  if (isLoading) return <p className="loading">Chargement...</p>;

  return (
    <div className="gift-container">
      <div className="gift-header">
        <h2>🎁 Ma Wishlist</h2>
      </div>

      {!showForm && (
        <button
          className="btn-profil btn-add-item"
          onClick={() => setShowForm(true)}
        >
          + Ajouter une idée
        </button>
      )}

      {showForm && (
        <div className="gift-form-card">
          <h3>{editingItem ? "Modifier l'idée" : "Nouvelle idée"}</h3>
          <form onSubmit={handleSubmit}>
            <div className="gift-form-input">
              <div className="gift-url-row">
                <input
                  type="url"
                  name="url"
                  className="form-input"
                  placeholder="Lien du produit (URL)"
                  value={formData.url}
                  onChange={handleInputChange}
                />
                <button
                  type="button"
                  className="btn-profil btn-fetch-url"
                  onClick={handleFetchUrl}
                  disabled={!formData.url.trim() || isFetchingUrl}
                >
                  {isFetchingUrl ? "⏳" : "🔍 Récupérer les infos avec le lien"}
                </button>
              </div>

              {fetchMessage && (
                <p
                  className={`fetch-message fetch-message--${fetchMessage.type}`}
                >
                  {fetchMessage.text}
                </p>
              )}

              {formData.image && (
                <div className="gift-image-preview">
                  <img
                    src={formData.image}
                    alt="Preview"
                    onError={(e) => {
                      e.target.style.display = "none";
                    }}
                  />
                </div>
              )}

              <input
                type="text"
                name="title"
                className="form-input"
                placeholder="Titre *"
                value={formData.title}
                onChange={handleInputChange}
                required
              />
              <textarea
                name="description"
                className="form-input"
                placeholder="Description (optionnel)"
                value={formData.description}
                onChange={handleInputChange}
                rows={2}
              />
              <input
                type="number"
                name="price"
                className="form-input"
                placeholder="Prix (€)"
                value={formData.price}
                onChange={handleInputChange}
                step="0.01"
                min="0"
              />
              <input
                type="url"
                name="image"
                className="form-input"
                placeholder="URL de l'image (optionnel)"
                value={formData.image}
                onChange={handleInputChange}
              />
            </div>

            <div className="gift-share-toggle">
              <label className="toggle-label">
                <input
                  type="checkbox"
                  name="isShared"
                  checked={formData.isShared}
                  onChange={handleInputChange}
                />
                <span className="toggle-text">
                  {formData.isShared
                    ? "🔓 Partagé avec mes contacts"
                    : "🔒 Privé"}
                </span>
              </label>
            </div>

            <div className="gift-form-buttons">
              <button type="submit" className="btn-profil btn-profilGreen">
                {editingItem ? "Enregistrer" : "Ajouter"}
              </button>
              <button
                type="button"
                className="btn-profil btn-profilGrey"
                onClick={handleCancel}
              >
                Annuler
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="gift-items">
        {wishlistItems.length === 0 ? (
          <p className="gift-empty">
            Votre wishlist est vide. Ajoutez vos envies ! 🎁
          </p>
        ) : (
          <>
            {/* Items disponibles */}
            {availableItems.map((item) => (
              <div key={item._id} className="gift-item-card">
                {deletingItemId !== item._id ? (
                  <div className="gift-item-horizontal">
                    {item.image && (
                      <div className="gift-item-img-wrapper">
                        <img
                          src={item.image}
                          alt={item.title}
                          onError={(e) => {
                            e.target.parentElement.style.display = "none";
                          }}
                        />
                      </div>
                    )}
                    <div className="gift-item-content">
                      <div className="gift-item-header">
                        <h4 className="gift-item-title">{item.title}</h4>
                        <span
                          className={`gift-item-badge ${item.isShared ? "shared" : "private"}`}
                        >
                          {item.isShared ? "🔓" : "🔒"}
                        </span>
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
                      {item.isPurchased && (
                        <p className="gift-item-purchased">✅ Acheté</p>
                      )}
                      <div className="gift-item-actions">
                        <button
                          className="btn-gift btn-toggle"
                          onClick={() => handleToggleSharing(item)}
                          title={item.isShared ? "Rendre privé" : "Partager"}
                        >
                          {item.isShared ? "🔒" : "🔓"}
                        </button>
                        <button
                          className="btn-gift btn-edit"
                          onClick={() => handleEdit(item)}
                        >
                          ✏️
                        </button>
                        <button
                          className="btn-gift btn-delete"
                          onClick={() => handleDeleteClick(item._id)}
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="gift-delete-confirm">
                    <div className="delete-confirm-icon">⚠️</div>
                    <h4 className="delete-confirm-title">
                      Supprimer cette idée ?
                    </h4>
                    <p className="delete-confirm-text">
                      <strong>{item.title}</strong>
                    </p>
                    <p className="delete-confirm-warning">
                      Cette action est irréversible
                    </p>
                    <div className="delete-confirm-buttons">
                      <button
                        className="btn-profil btn-profilGrey"
                        onClick={() => setDeletingItemId(null)}
                      >
                        Annuler
                      </button>
                      <button
                        className="btn-profil btn-delete"
                        onClick={() => handleConfirmDelete(item._id)}
                      >
                        Supprimer
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {/* Section items réservés — visibles uniquement par le propriétaire */}
            {reservedItems.length > 0 && (
              <>
                <p className="wishlist-reserved-title">
                  🎁 Déjà réservés par un ami
                </p>
                {reservedItems.map((item) => (
                  <div
                    key={item._id}
                    className="gift-item-card gift-item-card--reserved"
                  >
                    <div className="gift-item-horizontal">
                      {item.image && (
                        <div className="gift-item-img-wrapper">
                          <img
                            src={item.image}
                            alt={item.title}
                            onError={(e) => {
                              e.target.parentElement.style.display = "none";
                            }}
                          />
                        </div>
                      )}
                      <div className="gift-item-content">
                        <div className="gift-item-header">
                          <h4 className="gift-item-title">{item.title}</h4>
                          <span className="gift-item-badge reserved">
                            🎁 Réservé
                          </span>
                        </div>
                        <p className="gift-item-reserved-by">
                          🎁 Quelqu'un a réservé ce cadeau pour toi
                        </p>
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
                ))}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default Wishlist;
