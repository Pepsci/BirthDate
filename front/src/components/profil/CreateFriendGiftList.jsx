import React, { useState } from "react";
import apiHandler from "../../api/apiHandler";

const GiftForm = ({ dateId, onGiftAdded }) => {
  const [giftName, setGiftName] = useState("");
  const [purchased, setPurchased] = useState(false);

  const handleAddGift = async (e) => {
    e.preventDefault();
    try {
      const response = await apiHandler.patch(`/date/${dateId}/gifts`, {
        giftName,
        purchased,
      });
      onGiftAdded(response.data);
      setGiftName("");
      setPurchased(false);
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <form onSubmit={handleAddGift}>
      <input
        type="text"
        placeholder="Enter gift name"
        value={giftName}
        onChange={(e) => setGiftName(e.target.value)}
        required
      />
      <label>
        Purchased
        <input
          type="checkbox"
          checked={purchased}
          onChange={(e) => setPurchased(e.target.checked)}
        />
      </label>
      <button type="submit">Add Gift</button>
    </form>
  );
};

export default GiftForm;
