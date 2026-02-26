import React, { useState, useEffect } from "react";
import apiHandler from "../../api/apiHandler";
import "./css/GiftItem.css";

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

const getOccasionDisplay = (value) =>
  OCCASIONS.find((o) => o.value === value) || OCCASIONS[0];

// ─────────────────────────────────────────────────────────────────────────────

const GiftItem = ({ dateId, gift, onUpdate, onDelete }) => {
  console.log("Gift Item:", gift);

  if (!gift || !gift.giftName || !gift._id) {
    console.error("Gift is missing required properties");
    return null;
  }

  const [isEditing, setIsEditing] = useState(false);
  const [giftName, setGiftName] = useState(gift.giftName || "");
  const [occasion, setOccasion] = useState(gift.occasion || "Anniversaire");
  const [year, setYear] = useState(gift.year || new Date().getFullYear());
  const [purchased, setPurchased] = useState(gift.purchased || false);

  useEffect(() => {
    if (gift) {
      setGiftName(gift.giftName || "");
      setOccasion(gift.occasion || "Anniversaire");
      setYear(gift.year || new Date().getFullYear());
      setPurchased(gift.purchased || false);
    }
  }, [gift]);

  const handleUpdate = async () => {
    try {
      const response = await apiHandler.patch(
        `/date/${dateId}/gifts/${gift._id}`,
        {
          giftName,
          occasion,
          year: parseInt(year),
          purchased,
        },
      );
      onUpdate(response.data);
      setIsEditing(false);
    } catch (error) {
      console.error(error);
    }
  };

  const handlePurchasedChange = async (e) => {
    const newPurchased = e.target.checked;
    setPurchased(newPurchased);
    try {
      const response = await apiHandler.patch(
        `/date/${dateId}/gifts/${gift._id}`,
        {
          giftName,
          occasion,
          year: parseInt(year),
          purchased: newPurchased,
        },
      );
      onUpdate(response.data);
    } catch (error) {
      console.error(error);
    }
  };

  const handleDelete = async () => {
    try {
      const response = await apiHandler.delete(
        `/date/${dateId}/gifts/${gift._id}`,
      );
      onDelete(response.data);
    } catch (error) {
      console.error(error);
    }
  };

  const occasionDisplay = getOccasionDisplay(gift.occasion);

  return (
    <div className="gift-item-wrapper">
      {isEditing ? (
        <div className="giftList-giftItem editing">
          <input
            className="gift-input-edit"
            type="text"
            value={giftName}
            onChange={(e) => setGiftName(e.target.value)}
            placeholder="Nom du cadeau"
          />

          <select
            className="gift-select-edit"
            value={occasion}
            onChange={(e) => setOccasion(e.target.value)}
          >
            {OCCASIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.emoji} {o.label}
              </option>
            ))}
          </select>

          <input
            className="gift-input-year"
            type="number"
            value={year}
            onChange={(e) => setYear(e.target.value)}
            min="2000"
            max="2100"
          />

          <div className="giftList-btnEdit">
            <button className="giftList-btn btn-save" onClick={handleUpdate}>
              ✓
            </button>
            <button
              className="giftList-btn btn-cancel"
              onClick={() => setIsEditing(false)}
            >
              ✕
            </button>
          </div>
        </div>
      ) : (
        <div className="giftList-giftItem">
          <div className="gift-info-section">
            <div className="gift-header">
              <span className="gift-name">{gift.giftName}</span>
              <span className="gift-meta">
                <span className="gift-occasion">
                  {occasionDisplay.emoji} {occasionDisplay.label}
                </span>
                <span className="gift-year">
                  {gift.year || new Date().getFullYear()}
                </span>
              </span>
            </div>
          </div>

          <div className="gift-actions-section">
            <label className="giftList-checkbox">
              <input
                type="checkbox"
                checked={purchased}
                onChange={handlePurchasedChange}
              />
              <span className="checkbox-label">Acheté</span>
            </label>

            <div className="giftList-btnEdit">
              <button
                className="giftList-btn btn-edit"
                onClick={() => setIsEditing(true)}
              >
                ✏️
              </button>
              <button
                className="giftList-btn btn-delete"
                onClick={handleDelete}
              >
                🗑️
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GiftItem;
