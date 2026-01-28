import React, { useState } from "react";
import apiHandler from "../../api/apiHandler";
import "../UI/css/gifts-common.css";

const FriendGiftList = ({ currentDate, onUpdate }) => {
  const [showForm, setShowForm] = useState(false);
  const [editingGift, setEditingGift] = useState(null);
  const [deletingGiftId, setDeletingGiftId] = useState(null);

  const [showFilters, setShowFilters] = useState(false);
  const [filterOccasion, setFilterOccasion] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");

  const [formData, setFormData] = useState({
    giftName: "",
    occasion: "birthday",
    year: new Date().getFullYear(),
  });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.giftName.trim()) {
      alert("Le nom du cadeau est requis");
      return;
    }

    try {
      if (editingGift) {
        const response = await apiHandler.patch(
          `/date/${currentDate._id}/gifts/${editingGift._id}`,
          {
            giftName: formData.giftName,
            occasion: formData.occasion,
            year: parseInt(formData.year),
            purchased: editingGift.purchased,
          },
        );
        onUpdate(response.data);
      } else {
        const response = await apiHandler.patch(
          `/date/${currentDate._id}/gifts`,
          {
            giftName: formData.giftName,
            occasion: formData.occasion,
            year: parseInt(formData.year),
            purchased: false,
          },
        );
        onUpdate(response.data);
      }

      setFormData({
        giftName: "",
        occasion: "birthday",
        year: new Date().getFullYear(),
      });
      setShowForm(false);
      setEditingGift(null);
    } catch (error) {
      console.error("Erreur lors de la sauvegarde:", error);
      alert("Erreur lors de la sauvegarde");
    }
  };

  const handleEdit = (gift) => {
    setEditingGift(gift);
    setFormData({
      giftName: gift.giftName,
      occasion: gift.occasion || "birthday",
      year: gift.year || new Date().getFullYear(),
    });
    setShowForm(true);
    setDeletingGiftId(null);

    setTimeout(() => {
      const container = document.querySelector(".gift-container");
      if (container) {
        container.scrollTo({ top: 0, behavior: "smooth" });
      }
    }, 100);
  };

  const handleDeleteClick = (giftId) => {
    setDeletingGiftId(giftId);
    setShowForm(false);
    setEditingGift(null);
  };

  const handleCancelDelete = () => {
    setDeletingGiftId(null);
  };

  const handleConfirmDelete = async () => {
    if (!deletingGiftId) return;

    try {
      const response = await apiHandler.delete(
        `/date/${currentDate._id}/gifts/${deletingGiftId}`,
      );
      onUpdate(response.data);
      setDeletingGiftId(null);
    } catch (error) {
      console.error("Erreur lors de la suppression:", error);
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
        },
      );
      onUpdate(response.data);
    } catch (error) {
      console.error("Erreur lors du changement de statut:", error);
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingGift(null);
    setFormData({
      giftName: "",
      occasion: "birthday",
      year: new Date().getFullYear(),
    });
  };

  const getOccasionDisplay = (occasion) => {
    switch (occasion) {
      case "birthday":
        return { emoji: "🎂", label: "Anniversaire" };
      case "christmas":
        return { emoji: "🎄", label: "Noël" };
      case "other":
        return { emoji: "🎁", label: "Autre" };
      default:
        return { emoji: "🎁", label: "Anniversaire" };
    }
  };

  const gifts = currentDate.gifts || [];
  const validGifts = gifts.filter((gift) => gift && gift.giftName && gift._id);

  const filteredGifts = validGifts.filter((gift) => {
    const matchesOccasion =
      filterOccasion === "all" || gift.occasion === filterOccasion;
    const matchesStatus =
      filterStatus === "all" ||
      (filterStatus === "purchased" && gift.purchased) ||
      (filterStatus === "pending" && !gift.purchased);
    return matchesOccasion && matchesStatus;
  });

  const activeFiltersCount =
    (filterOccasion !== "all" ? 1 : 0) + (filterStatus !== "all" ? 1 : 0);

  return (
    <div className="gift-container">
      <div className="gift-header">
        <h2>🎁 Vos idées de cadeaux</h2>
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
          <h3>{editingGift ? "Modifier l'idée" : "Nouvelle idée"}</h3>
          <form onSubmit={handleSubmit}>
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
              <option value="birthday">🎂 Anniversaire</option>
              <option value="christmas">🎄 Noël</option>
              <option value="other">🎁 Autre occasion</option>
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
                className={`filter-btn ${
                  filterOccasion === "all" ? "active" : ""
                }`}
                onClick={() => setFilterOccasion("all")}
              >
                Tous
              </button>
              <button
                className={`filter-btn ${
                  filterOccasion === "birthday" ? "active" : ""
                }`}
                onClick={() => setFilterOccasion("birthday")}
              >
                🎂
              </button>
              <button
                className={`filter-btn ${
                  filterOccasion === "christmas" ? "active" : ""
                }`}
                onClick={() => setFilterOccasion("christmas")}
              >
                🎄
              </button>
              <button
                className={`filter-btn ${
                  filterOccasion === "other" ? "active" : ""
                }`}
                onClick={() => setFilterOccasion("other")}
              >
                🎁
              </button>
            </div>
          </div>

          <div className="filter-group">
            <h4 className="filter-title">Statut</h4>
            <div className="filter-buttons">
              <button
                className={`filter-btn ${
                  filterStatus === "all" ? "active" : ""
                }`}
                onClick={() => setFilterStatus("all")}
              >
                Tous
              </button>
              <button
                className={`filter-btn ${
                  filterStatus === "pending" ? "active" : ""
                }`}
                onClick={() => setFilterStatus("pending")}
              >
                ⭕
              </button>
              <button
                className={`filter-btn ${
                  filterStatus === "purchased" ? "active" : ""
                }`}
                onClick={() => setFilterStatus("purchased")}
              >
                ✅
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="gift-items">
        {filteredGifts.length === 0 ? (
          <p className="gift-empty">
            {filterOccasion !== "all" || filterStatus !== "all"
              ? "Aucun cadeau ne correspond aux filtres sélectionnés"
              : "Aucune idée de cadeau pour le moment 💡"}
          </p>
        ) : (
          filteredGifts.map((gift) => {
            const occasionDisplay = getOccasionDisplay(gift.occasion);

            return (
              <div key={gift._id} className="gift-item-card">
                {deletingGiftId !== gift._id ? (
                  <>
                    <div className="gift-item-header">
                      <h4 className="gift-item-title">{gift.giftName}</h4>
                      <span
                        className={`gift-item-badge ${
                          gift.purchased ? "purchased" : "pending"
                        }`}
                      >
                        {gift.purchased ? "✅ Acheté" : "⭕ À acheter"}
                      </span>
                    </div>

                    <div className="gift-item-meta">
                      <span className="gift-occasion">
                        {occasionDisplay.emoji} {occasionDisplay.label}
                      </span>
                      <span className="gift-year">
                        {gift.year || new Date().getFullYear()}
                      </span>
                    </div>

                    <div className="gift-item-actions">
                      <button
                        className="btn-gift btn-toggle"
                        onClick={() => handleTogglePurchased(gift)}
                        title={
                          gift.purchased
                            ? "Marquer comme non acheté"
                            : "Marquer comme acheté"
                        }
                      >
                        {gift.purchased ? "✅" : "⭕"}
                      </button>
                      <button
                        className="btn-gift btn-edit"
                        onClick={() => handleEdit(gift)}
                      >
                        ✏️
                      </button>
                      <button
                        className="btn-gift btn-delete"
                        onClick={() => handleDeleteClick(gift._id)}
                      >
                        🗑️
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="gift-delete-confirm">
                    <div className="delete-confirm-icon">⚠️</div>
                    <h4 className="delete-confirm-title">
                      Supprimer cette idée ?
                    </h4>
                    <p className="delete-confirm-text">
                      <strong>{gift.giftName}</strong>
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
                        onClick={handleConfirmDelete}
                      >
                        Supprimer
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default FriendGiftList;
