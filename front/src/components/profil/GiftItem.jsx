import React, { useState, useEffect } from "react";
import apiHandler from "../../api/apiHandler";
import "./css/GiftItem.css";

const GiftItem = ({ dateId, gift, onUpdate, onDelete }) => {
  console.log("Gift Item:", gift);

  if (!gift || !gift.giftName || !gift._id) {
    console.error("Gift is missing required properties");
    return null;
  }

  const [isEditing, setIsEditing] = useState(false);
  const [giftName, setGiftName] = useState(gift.giftName || "");
  const [occasion, setOccasion] = useState(gift.occasion || "birthday");
  const [year, setYear] = useState(gift.year || new Date().getFullYear());
  const [purchased, setPurchased] = useState(gift.purchased || false);

  useEffect(() => {
    if (gift) {
      setGiftName(gift.giftName || "");
      setOccasion(gift.occasion || "birthday");
      setYear(gift.year || new Date().getFullYear());
      setPurchased(gift.purchased || false);
    }
  }, [gift]);

  // Fonction pour obtenir l'emoji et le label de l'occasion
  const getOccasionDisplay = (occ) => {
    switch (occ) {
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

  const handleUpdate = async () => {
    try {
      const response = await apiHandler.patch(
        `/date/${dateId}/gifts/${gift._id}`,
        {
          giftName,
          occasion,
          year: parseInt(year),
          purchased,
        }
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
        }
      );
      onUpdate(response.data);
    } catch (error) {
      console.error(error);
    }
  };

  const handleDelete = async () => {
    try {
      const response = await apiHandler.delete(
        `/date/${dateId}/gifts/${gift._id}`
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
            <option value="birthday">🎂 Anniversaire</option>
            <option value="christmas">🎄 Noël</option>
            <option value="other">🎁 Autre</option>
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
