import React, { useState, useEffect } from "react";
import apiHandler from "../../api/apiHandler";
import useAuth from "../../context/useAuth";
import "./css/wishlist.css";

const Wishlist = () => {
  const { currentUser } = useAuth();
  const [wishlistItems, setWishlistItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [deletingItemId, setDeletingItemId] = useState(null); // 👈 NOUVEAU

  // Formulaire
  const [formData, setFormData] = useState({
    title: "",
    price: "",
    url: "",
    isShared: false,
  });

  // Charger la wishlist au montage
  useEffect(() => {
    if (currentUser) {
      fetchWishlist();
    }
  }, [currentUser]);

  const fetchWishlist = async () => {
    try {
      setIsLoading(true);
      const response = await apiHandler.get(
        `/wishlist?userId=${currentUser._id}`
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
        // Modification
        await apiHandler.patch(`/wishlist/${editingItem._id}`, formData);
      } else {
        // Création
        await apiHandler.post("/wishlist", {
          ...formData,
          userId: currentUser._id,
        });
      }

      // Réinitialiser et recharger
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
    setDeletingItemId(null); // 👈 Annuler la suppression si active
  };

  // 👇 NOUVEAU : Activer le mode suppression
  const handleDeleteClick = (itemId) => {
    setDeletingItemId(itemId);
    setShowForm(false); // Fermer le formulaire si ouvert
    setEditingItem(null);
  };

  // 👇 NOUVEAU : Annuler la suppression
  const handleCancelDelete = () => {
    setDeletingItemId(null);
  };

  // 👇 NOUVEAU : Confirmer la suppression
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
    return <p style={{ textAlign: "center", color: "#fff" }}>Chargement...</p>;
  }

  return (
    <div className="wishlist-container">
      <div className="wishlist-header">
        <h2>🎁 Ma Wishlist</h2>
        <p className="wishlist-count">
          {wishlistItems.length} idée{wishlistItems.length > 1 ? "s" : ""}
        </p>
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
        <div className="wishlist-form-card">
          <h3>{editingItem ? "Modifier l'idée" : "Nouvel idée"}</h3>
          <form className="form-connect wishlist-form" onSubmit={handleSubmit}>
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
            <div className="wishlist-share-toggle">
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
            <div className="wishlist-form-buttons">
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

      <div className="wishlist-items">
        {wishlistItems.length === 0 ? (
          <p className="wishlist-empty">
            Votre wishlist est vide. Ajoutez vos envies ! 🎁
          </p>
        ) : (
          wishlistItems.map((item) => (
            <div key={item._id} className="wishlist-item-card">
              {/* 👇 MODE NORMAL */}
              {deletingItemId !== item._id ? (
                <>
                  <div className="wishlist-item-header">
                    <h4 className="wishlist-item-title">{item.title}</h4>
                    <span
                      className={`wishlist-item-badge ${
                        item.isShared ? "shared" : "private"
                      }`}
                    >
                      {item.isShared ? "🔓 Partagé" : "🔒 Privé"}
                    </span>
                  </div>

                  {item.price && (
                    <p className="wishlist-item-price">{item.price} €</p>
                  )}

                  {item.url && (
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="wishlist-item-link"
                    >
                      🔗 Voir le lien
                    </a>
                  )}

                  {item.isPurchased && (
                    <p className="wishlist-item-purchased">✅ Acheté</p>
                  )}

                  <div className="wishlist-item-actions">
                    <button
                      className="btn-wishlist btn-toggle"
                      onClick={() => handleToggleSharing(item)}
                      title={item.isShared ? "Rendre privé" : "Partager"}
                    >
                      {item.isShared ? "🔒" : "🔓"}
                    </button>
                    <button
                      className="btn-wishlist btn-edit"
                      onClick={() => handleEdit(item)}
                    >
                      ✏️
                    </button>
                    <button
                      className="btn-wishlist btn-delete"
                      onClick={() => handleDeleteClick(item._id)}
                    >
                      🗑️
                    </button>
                  </div>
                </>
              ) : (
                /* 👇 MODE SUPPRESSION */
                <div className="wishlist-delete-confirm">
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
