import React, { useState } from "react";
import apiHandler from "../../api/apiHandler";
import "../UI/css/gifts-common.css";

const GiftForm = ({ dateId, onGiftAdded }) => {
  const [giftName, setGiftName] = useState("");
  const [occasion, setOccasion] = useState("birthday");
  const [year, setYear] = useState(new Date().getFullYear());
  const [purchased, setPurchased] = useState(false);

  const handleAddGift = async (e) => {
    e.preventDefault();

    const giftData = {
      giftName,
      occasion,
      year: parseInt(year),
      purchased,
    };

    try {
      const response = await apiHandler.patch(
        `/date/${dateId}/gifts`,
        giftData,
      );
      onGiftAdded(response.data);

      setGiftName("");
      setOccasion("birthday");
      setYear(new Date().getFullYear());
      setPurchased(false);
    } catch (error) {
      console.error("❌ Erreur:", error);
    }
  };

  return (
    <div className="gift-form-card">
      <h3>Nouvelle idée</h3>
      <form onSubmit={handleAddGift}>
        <div className="gift-form-input">
          <input
            className="form-input"
            type="text"
            placeholder="Nom du cadeau *"
            value={giftName}
            onChange={(e) => setGiftName(e.target.value)}
            required
          />

          <select
            className="form-input"
            value={occasion}
            onChange={(e) => setOccasion(e.target.value)}
          >
            <option value="birthday">🎂 Anniversaire</option>
            <option value="christmas">🎄 Noël</option>
            <option value="other">🎁 Autre occasion</option>
          </select>

          <input
            className="form-input"
            type="number"
            placeholder="Année"
            value={year}
            onChange={(e) => setYear(e.target.value)}
            min="2000"
            max="2100"
            required
          />
        </div>

        <div className="gift-form-buttons">
          <button type="submit" className="btn-profil btn-profilGreen">
            Ajouter
          </button>
        </div>
      </form>
    </div>
  );
};

export default GiftForm;
