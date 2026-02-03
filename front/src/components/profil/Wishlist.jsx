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

  const [formData, setFormData] = useState({
    title: "",
    price: "",
    url: "",
    isShared: false,
  });

  useEffect(() => {
    if (currentUser) {
      fetchWishlist();
    }
  }, [currentUser]);

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
    setFormData({
      ...formData,
      [name]: type === "checkbox" ? checked : value,
    });
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

      setFormData({ title: "", price: "", url: "", isShared: false });
      setShowForm(false);
      setEditingItem(null);
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
      price: item.price || "",
      url: item.url || "",
      isShared: item.isShared,
    });
    setShowForm(true);
    setDeletingItemId(null);

    setTimeout(() => {
      const targets = [
        document.querySelector(".gift-container"),
        document.querySelector(".mobile-carousel__content"),
        document.querySelector(".desktop-content"),
      ];
      targets.forEach((el) => {
        if (el) el.scrollTo({ top: 0, behavior: "smooth" });
      });
    }, 100);
  };

  const handleDeleteClick = (itemId) => {
    setDeletingItemId(itemId);
    setShowForm(false);
    setEditingItem(null);
  };

  const handleCancelDelete = () => {
    setDeletingItemId(null);
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
    setFormData({ title: "", price: "", url: "", isShared: false });
  };

  if (isLoading) {
    return <p className="loading">Chargement...</p>;
  }

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
          <h3>{editingItem ? "Modifier l'idée" : "Nouvel idée"}</h3>
          <form className="" onSubmit={handleSubmit}>
            <div className="gift-form-input">
              <input
                type="text"
                name="title"
                className="form-input"
                placeholder="Titre *"
                value={formData.title}
                onChange={handleInputChange}
                required
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
                name="url"
                className="form-input"
                placeholder="Lien (URL)"
                value={formData.url}
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
          wishlistItems.map((item) => (
            <div key={item._id} className="gift-item-card">
              {deletingItemId !== item._id ? (
                <>
                  <div className="gift-item-header">
                    <h4 className="gift-item-title">{item.title}</h4>
                    <span
                      className={`gift-item-badge ${
                        item.isShared ? "shared" : "private"
                      }`}
                    >
                      {item.isShared ? "🔓 Partagé" : "🔒 Privé"}
                    </span>
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
                      🔗 Voir le lien
                    </a>
                  )}

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
                </>
              ) : (
                <div className="gift-delete-confirm">
                  <div className="delete-confirm-icon">⚠️</div>
                  <h4 className="delete-confirm-title">Supprimer cet idée ?</h4>
                  <p className="delete-confirm-text">
                    <strong>{item.title}</strong>
                  </p>
                  <p className="delete-confirm-warning">
                    Cette action est irréversible
                  </p>
                  <div className="delete-confirm-buttons">
                    <button
                      className="btn-profil btn-profilGrey"
                      onClick={handleCancelDelete}
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
          ))
        )}
      </div>
    </div>
  );
};

export default Wishlist;
