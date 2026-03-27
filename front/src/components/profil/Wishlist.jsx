import React, { useState, useEffect } from "react";
import apiHandler from "../../api/apiHandler";
import useAuth from "../../context/useAuth";
import GiftCardGrid from "../UI/GiftCardGrid";
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

  useEffect(() => {
    if (!formData.url) {
      setFetchMessage(null);
      return;
    }
    const matched = blockedDomains.find((s) =>
      formData.url.toLowerCase().includes(s.domain),
    );
    if (matched)
      setFetchMessage({
        type: "warning",
        text: `⚠️ ${matched.name} ne supporte pas le remplissage automatique — remplis les champs manuellement`,
      });
    else
      setFetchMessage((prev) =>
        prev?.text?.includes("ne supporte pas") ? null : prev,
      );
  }, [formData.url]);

  const fetchWishlist = async () => {
    try {
      setIsLoading(true);
      const r = await apiHandler.get(`/wishlist?userId=${currentUser._id}`);
      setWishlistItems(r.data.data || []);
    } catch (e) {
      console.error(e);
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
      const r = await apiHandler.post("/wishlist/fetch-url", {
        url: formData.url,
      });
      if (!r.data.success) {
        setFetchMessage({
          type: "warning",
          text: `⚠️ ${r.data.message || "Ce site ne permet pas la récupération automatique"}`,
        });
        return;
      }
      const { title, description, image, price } = r.data.data;
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
    } catch {
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
      if (editingItem)
        await apiHandler.patch(`/wishlist/${editingItem._id}`, formData);
      else
        await apiHandler.post("/wishlist", {
          ...formData,
          userId: currentUser._id,
        });
      handleCancel();
      fetchWishlist();
    } catch {
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
  const handleDelete = (id) => setDeletingItemId(id);
  const handleDeleteCancel = () => setDeletingItemId(null);
  const handleDeleteConfirm = async (id) => {
    try {
      await apiHandler.delete(`/wishlist/${id}`);
      setDeletingItemId(null);
      fetchWishlist();
    } catch {
      alert("Erreur lors de la suppression");
    }
  };
  const handleToggleSharing = async (item) => {
    try {
      await apiHandler.post(`/wishlist/${item._id}/toggle-sharing`);
      fetchWishlist();
    } catch {
      console.error("Erreur toggle sharing");
    }
  };

  if (isLoading) return <p className="loading">Chargement...</p>;

  return (
    <div className="gift-container">
      <div className="gift-header">
        <h2>🎁 Ma Wishlist</h2>
      </div>

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

      {wishlistItems.length === 0 && !showForm ? (
        <p className="gift-empty">
          Votre wishlist est vide. Ajoutez vos envies ! 🎁
        </p>
      ) : (
        <GiftCardGrid
          items={wishlistItems}
          type="wishlist"
          currentUserId={currentUser._id}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onToggle={handleToggleSharing}
          deletingId={deletingItemId}
          onDeleteConfirm={handleDeleteConfirm}
          onDeleteCancel={handleDeleteCancel}
          showAddCard={!showForm}
          onAdd={() => setShowForm(true)}
        />
      )}
    </div>
  );
};

export default Wishlist;
