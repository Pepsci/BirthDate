import React, { useState } from "react";
import apiHandler from "../../api/apiHandler";
import "./css/giftForm.css";

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

    console.log("📤 Envoi du cadeau:", giftData);

    try {
      const response = await apiHandler.patch(
        `/date/${dateId}/gifts`,
        giftData
      );
      console.log("✅ Réponse serveur:", response.data);
      console.log(
        "🎁 Dernier cadeau ajouté:",
        response.data.gifts[response.data.gifts.length - 1]
      );

      onGiftAdded(response.data);

      // Réinitialiser le formulaire
      setGiftName("");
      setOccasion("birthday");
      setYear(new Date().getFullYear());
      setPurchased(false);
    } catch (error) {
      console.error("❌ Erreur:", error);
    }
  };

  return (
    <form className="formGift-friendProfil" onSubmit={handleAddGift}>
      <input
        className="inputGift-friendProfil"
        type="text"
        placeholder="Nom du cadeau"
        value={giftName}
        onChange={(e) => setGiftName(e.target.value)}
        required
      />

      <select
        className="inputGift-friendProfil select-gift"
        value={occasion}
        onChange={(e) => {
          console.log("🎯 Occasion changée:", e.target.value);
          setOccasion(e.target.value);
        }}
      >
        <option value="birthday">🎂 Anniversaire</option>
        <option value="christmas">🎄 Noël</option>
        <option value="other">🎁 Autre occasion</option>
      </select>

      <input
        className="inputGift-friendProfil"
        type="number"
        placeholder="Année"
        value={year}
        onChange={(e) => setYear(e.target.value)}
        min="2000"
        max="2100"
        required
      />

      <button className="addGift-friendProfil" type="submit">
        Ajouter un cadeau
      </button>
    </form>
  );
};

export default GiftForm;
