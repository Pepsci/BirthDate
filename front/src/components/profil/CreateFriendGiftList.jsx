import React, { useState } from "react";
import apiHandler from "../../api/apiHandler";

const GiftItem = ({ dateId, gift, onUpdate, onDelete }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [giftName, setGiftName] = useState(gift.giftName);
  const [purchased, setPurchased] = useState(gift.purchased);

  const handleUpdate = async () => {
    try {
      const response = await apiHandler.patch(
        `/date/${dateId}/gifts/${gift._id}`,
        {
          giftName,
          purchased,
        }
      );
      onUpdate(response.data);
      setIsEditing(false);
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

  return (
    <li>
      {isEditing ? (
        <div>
          <input
            type="text"
            value={giftName}
            onChange={(e) => setGiftName(e.target.value)}
          />
          <label>
            Purchased
            <input
              type="checkbox"
              checked={purchased}
              onChange={(e) => setPurchased(e.target.checked)}
            />
          </label>
          <button onClick={handleUpdate}>Save</button>
          <button onClick={() => setIsEditing(false)}>Cancel</button>
        </div>
      ) : (
        <div>
          {gift.giftName} - {gift.purchased ? "Acheté" : "Non acheté"}
          <button onClick={() => setIsEditing(true)}>Edit</button>
          <button onClick={handleDelete}>Delete</button>
        </div>
      )}
    </li>
  );
};

export default GiftItem;
