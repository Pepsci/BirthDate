import React, { useState, useEffect } from "react";
import apiHandler from "../../api/apiHandler";

const GiftItem = ({ dateId, gift, onUpdate, onDelete }) => {
  console.log("Gift Item:", gift); // Vérifiez les données

  if (!gift || !gift.giftName || !gift._id) {
    console.error("Gift is missing required properties");
    return null;
  }

  const [isEditing, setIsEditing] = useState(false);
  const [giftName, setGiftName] = useState(gift.giftName || "");
  const [purchased, setPurchased] = useState(gift.purchased || false);

  useEffect(() => {
    if (gift) {
      setGiftName(gift.giftName || "");
      setPurchased(gift.purchased || false);
    }
  }, [gift]);

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

  const handlePurchasedChange = async (e) => {
    const newPurchased = e.target.checked;
    setPurchased(newPurchased);
    try {
      const response = await apiHandler.patch(
        `/date/${dateId}/gifts/${gift._id}`,
        {
          giftName,
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

  return (
    <div>
      {isEditing ? (
        <div className="giftList-giftItem">
          <input
            type="text"
            value={giftName}
            onChange={(e) => setGiftName(e.target.value)}
          />
          <div className="giftList-btnEdit">
            <button className="giftList-btn" onClick={handleUpdate}>
              Save
            </button>
            <button
              className="giftList-btn"
              onClick={() => setIsEditing(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="giftList-giftItem">
          <div className="giftList-name">
            <span>{gift.giftName}</span>
          </div>
          <label className="giftList-checkbox">
            <input
              type="checkbox"
              checked={purchased}
              onChange={handlePurchasedChange}
            />
            Acheté
          </label>
          <div className="giftList-btnEdit">
            <button className="giftList-btn" onClick={() => setIsEditing(true)}>
              Edit
            </button>
            <button className="giftList-btn" onClick={handleDelete}>
              Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default GiftItem;
