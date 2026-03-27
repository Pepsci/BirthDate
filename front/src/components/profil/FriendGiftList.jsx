import React, { useState } from "react";
import apiHandler from "../../api/apiHandler";
import GiftCardGrid from "../UI/GiftCardGrid";
import GiftShareModal from "../chat/GiftShareModal";
import "../UI/css/gifts-common.css";

const OCCASIONS = [
  { value: "Anniversaire", emoji: "🎂", label: "Anniversaire" },
  { value: "Noël", emoji: "🎄", label: "Noël" },
  { value: "Saint-Valentin", emoji: "💝", label: "Saint-Valentin" },
  { value: "Fête des Mères", emoji: "💐", label: "Fête des Mères" },
  { value: "Fête des Pères", emoji: "👔", label: "Fête des Pères" },
  { value: "Mariage", emoji: "💍", label: "Mariage" },
  { value: "Naissance", emoji: "👶", label: "Naissance" },
  { value: "Diplôme", emoji: "🎓", label: "Diplôme" },
  { value: "Crémaillère", emoji: "🏠", label: "Crémaillère" },
  { value: "Autre", emoji: "✨", label: "Autre" },
];

const BLOCKED_DOMAINS = [
  { domain: "amazon", name: "Amazon" },
  { domain: "fnac", name: "Fnac" },
  { domain: "micromania", name: "Micromania" },
];

const DEFAULT_FORM = {
  giftName: "",
  occasion: "Anniversaire",
  year: new Date().getFullYear(),
  url: "",
  price: "",
  image: "",
};

const FriendGiftList = ({
  currentDate,
  onUpdate,
  conversationId,
  recipientName,
}) => {
  const [showForm, setShowForm] = useState(false);
  const [editingGift, setEditingGift] = useState(null);
  const [deletingGiftId, setDeletingGiftId] = useState(null);
  const [formData, setFormData] = useState(DEFAULT_FORM);
  const [showShareModal, setShowShareModal] = useState(false);
  const [isFetchingUrl, setIsFetchingUrl] = useState(false);
  const [fetchMessage, setFetchMessage] = useState(null);

  const [showFilters, setShowFilters] = useState(false);
  const [filterOccasion, setFilterOccasion] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => {
      const updated = { ...prev, [name]: value };
      // Détection sites bloqués à la saisie URL
      if (name === "url") {
        const matched = BLOCKED_DOMAINS.find((s) =>
          value.toLowerCase().includes(s.domain),
        );
        if (matched) {
          setFetchMessage({
            type: "warning",
            text: `⚠️ ${matched.name} ne supporte pas le remplissage automatique — remplis les champs manuellement`,
          });
        } else if (!value) {
          setFetchMessage(null);
        } else {
          setFetchMessage((prev) =>
            prev?.text?.includes("ne supporte pas") ? null : prev,
          );
        }
      }
      return updated;
    });
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
        giftName: title || prev.giftName,
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
    if (!formData.giftName.trim()) {
      alert("Le nom du cadeau est requis");
      return;
    }
    try {
      const payload = {
        giftName: formData.giftName,
        occasion: formData.occasion,
        year: parseInt(formData.year),
        purchased: editingGift ? editingGift.purchased : false,
        url: formData.url || null,
        price: formData.price ? Number(formData.price) : null,
        image: formData.image || null,
      };
      const url = editingGift
        ? `/date/${currentDate._id}/gifts/${editingGift._id}`
        : `/date/${currentDate._id}/gifts`;
      const response = await apiHandler.patch(url, payload);
      onUpdate(response.data);
      setFormData(DEFAULT_FORM);
      setShowForm(false);
      setEditingGift(null);
      setFetchMessage(null);
    } catch {
      alert("Erreur lors de la sauvegarde");
    }
  };

  const handleEdit = (gift) => {
    setEditingGift(gift);
    setFormData({
      giftName: gift.giftName,
      occasion: gift.occasion || "Anniversaire",
      year: gift.year || new Date().getFullYear(),
      url: gift.url || "",
      price: gift.price || "",
      image: gift.image || "",
    });
    setFetchMessage(null);
    setShowForm(true);
    setDeletingGiftId(null);
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
    setEditingGift(null);
    setFormData(DEFAULT_FORM);
    setFetchMessage(null);
  };

  const handleDelete = (id) => {
    setDeletingGiftId(id);
    setShowForm(false);
    setEditingGift(null);
  };
  const handleDeleteCancel = () => setDeletingGiftId(null);
  const handleDeleteConfirm = async (id) => {
    try {
      const response = await apiHandler.delete(
        `/date/${currentDate._id}/gifts/${id}`,
      );
      onUpdate(response.data);
      setDeletingGiftId(null);
    } catch {
      alert("Erreur lors de la suppression");
    }
  };

  const handleTogglePurchased = async (gift) => {
    try {
      const response = await apiHandler.patch(
        `/date/${currentDate._id}/gifts/${gift._id}`,
        {
          giftName: gift.giftName,
          occasion: gift.occasion,
          year: gift.year,
          purchased: !gift.purchased,
          url: gift.url,
          price: gift.price,
          image: gift.image,
        },
      );
      onUpdate(response.data);
    } catch {
      console.error("Erreur toggle");
    }
  };

  const gifts = currentDate.gifts || [];
  const validGifts = gifts.filter((g) => g && g.giftName && g._id);
  const filteredGifts = validGifts.filter((gift) => {
    const mo = filterOccasion === "all" || gift.occasion === filterOccasion;
    const ms =
      filterStatus === "all" ||
      (filterStatus === "purchased" && gift.purchased) ||
      (filterStatus === "pending" && !gift.purchased);
    return mo && ms;
  });
  const activeFiltersCount =
    (filterOccasion !== "all" ? 1 : 0) + (filterStatus !== "all" ? 1 : 0);

  return (
    <div className="gift-container">
      <div className="gift-header">
        <h2>🎁 Vos idées de cadeaux</h2>
        {validGifts.length > 0 && (
          <button
            className="btn-gift-share"
            onClick={() => setShowShareModal(true)}
          >
            📤 Partager
          </button>
        )}
      </div>

      {showForm && (
        <div className="gift-form-card">
          <h3>{editingGift ? "Modifier l'idée" : "Nouvelle idée"}</h3>
          <form onSubmit={handleSubmit}>
            <div className="gift-form-input">
              {/* URL + fetch auto */}
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

              {/* Preview image */}
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

              {/* Nom */}
              <input
                type="text"
                name="giftName"
                className="form-input"
                placeholder="Nom du cadeau *"
                value={formData.giftName}
                onChange={handleInputChange}
                required
              />

              {/* Occasion */}
              <select
                name="occasion"
                className="form-input"
                value={formData.occasion}
                onChange={handleInputChange}
              >
                {OCCASIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.emoji} {o.label}
                  </option>
                ))}
              </select>

              {/* Année + Prix sur la même ligne */}
              <div style={{ display: "flex", gap: "8px", width: "100%" }}>
                <input
                  type="number"
                  name="year"
                  className="form-input"
                  placeholder="Année"
                  value={formData.year}
                  onChange={handleInputChange}
                  min="2000"
                  max="2100"
                  required
                  style={{ flex: 1 }}
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
                  style={{ flex: 1 }}
                />
              </div>

              {/* URL image manuelle */}
              <input
                type="url"
                name="image"
                className="form-input"
                placeholder="URL de l'image (optionnel)"
                value={formData.image}
                onChange={handleInputChange}
              />
            </div>

            <div className="gift-form-buttons">
              <button type="submit" className="btn-profil btn-profilGreen">
                {editingGift ? "Enregistrer" : "Ajouter"}
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

      {/* Filtres */}
      <button
        className="btn-toggle-filters"
        onClick={() => setShowFilters(!showFilters)}
      >
        🔍 Filtres
        {activeFiltersCount > 0 && (
          <span className="filter-badge">{activeFiltersCount}</span>
        )}
        <span className={`filter-arrow ${showFilters ? "open" : ""}`}> ▼</span>
      </button>

      {showFilters && (
        <div className="gift-filters">
          <div className="filter-group">
            <h4 className="filter-title">Occasion</h4>
            <div className="filter-buttons">
              <button
                className={`filter-btn ${filterOccasion === "all" ? "active" : ""}`}
                onClick={() => setFilterOccasion("all")}
              >
                Tous
              </button>
              {OCCASIONS.map((o) => (
                <button
                  key={o.value}
                  className={`filter-btn ${filterOccasion === o.value ? "active" : ""}`}
                  onClick={() => setFilterOccasion(o.value)}
                  title={o.label}
                >
                  {o.emoji}
                </button>
              ))}
            </div>
          </div>
          <div className="filter-group">
            <h4 className="filter-title">Statut</h4>
            <div className="filter-buttons">
              <button
                className={`filter-btn ${filterStatus === "all" ? "active" : ""}`}
                onClick={() => setFilterStatus("all")}
              >
                Tous
              </button>
              <button
                className={`filter-btn ${filterStatus === "pending" ? "active" : ""}`}
                onClick={() => setFilterStatus("pending")}
              >
                ⭕
              </button>
              <button
                className={`filter-btn ${filterStatus === "purchased" ? "active" : ""}`}
                onClick={() => setFilterStatus("purchased")}
              >
                ✅
              </button>
            </div>
          </div>
        </div>
      )}

      {filteredGifts.length === 0 ? (
        <GiftCardGrid
          items={[]}
          type="gifts"
          showAddCard={!showForm}
          onAdd={() => setShowForm(true)}
        />
      ) : (
        <GiftCardGrid
          items={filteredGifts}
          type="gifts"
          onEdit={handleEdit}
          onDelete={handleDelete}
          onToggle={handleTogglePurchased}
          deletingId={deletingGiftId}
          onDeleteConfirm={handleDeleteConfirm}
          onDeleteCancel={handleDeleteCancel}
          showAddCard={!showForm}
          onAdd={() => setShowForm(true)}
        />
      )}

      {showShareModal && (
        <GiftShareModal
          currentDate={currentDate}
          onClose={() => setShowShareModal(false)}
        />
      )}
    </div>
  );
};

export default FriendGiftList;
