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
const DEFAULT_FORM = {
  giftName: "",
  occasion: "Anniversaire",
  year: new Date().getFullYear(),
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
  const [showFilters, setShowFilters] = useState(false);
  const [filterOccasion, setFilterOccasion] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((p) => ({ ...p, [name]: value }));
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
      };
      const url = editingGift
        ? `/date/${currentDate._id}/gifts/${editingGift._id}`
        : `/date/${currentDate._id}/gifts`;
      const r = await apiHandler.patch(url, payload);
      onUpdate(r.data);
      setFormData(DEFAULT_FORM);
      setShowForm(false);
      setEditingGift(null);
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
    });
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
  };
  const handleDelete = (id) => {
    setDeletingGiftId(id);
    setShowForm(false);
    setEditingGift(null);
  };
  const handleDeleteCancel = () => setDeletingGiftId(null);
  const handleDeleteConfirm = async (id) => {
    try {
      const r = await apiHandler.delete(`/date/${currentDate._id}/gifts/${id}`);
      onUpdate(r.data);
      setDeletingGiftId(null);
    } catch {
      alert("Erreur lors de la suppression");
    }
  };
  const handleTogglePurchased = async (gift) => {
    try {
      const r = await apiHandler.patch(
        `/date/${currentDate._id}/gifts/${gift._id}`,
        {
          giftName: gift.giftName,
          occasion: gift.occasion,
          year: gift.year,
          purchased: !gift.purchased,
        },
      );
      onUpdate(r.data);
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
              <input
                type="text"
                name="giftName"
                className="form-input"
                placeholder="Nom du cadeau *"
                value={formData.giftName}
                onChange={handleInputChange}
                required
              />
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
