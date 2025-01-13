import React, { useState, useEffect } from "react";
import apiHandler from "../../api/apiHandler";
// import "./css/updateDate.css";

const UpdateDate = ({ date, onCancel }) => {
  const [dateToUpdate, setDateToUpdate] = useState(date);
  const [showConfirm, setShowConfirm] = useState(false); // État pour gérer l'affichage de la confirmation

  useEffect(() => {
    apiHandler
      .get(`/date/${date._id}`)
      .then((response) => {
        setDateToUpdate(response.data);
      })
      .catch((error) => {
        console.error(error);
      });
  }, [date._id]);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setDateToUpdate({
      ...dateToUpdate,
      [name]: type === "checkbox" ? checked : value,
    });
  };

  const handleUpdateDate = async (e) => {
    e.preventDefault();
    try {
      await apiHandler.patch(`/date/${date._id}`, dateToUpdate);
      onCancel();
    } catch (error) {
      console.error(error);
    }
  };

  const handleDeleteDate = async () => {
    try {
      await apiHandler.delete(`/date/${date._id}`);
      onCancel();
    } catch (error) {
      console.error(error);
    }
  };

  const handleShowConfirm = () => {
    setShowConfirm(true);
  };

  const handleCancelDelete = () => {
    setShowConfirm(false);
  };

  return (
    <div className="form-connect">
      <form className="form" onSubmit={handleUpdateDate}>
        <input
          className="form-input"
          type="text"
          name="name"
          placeholder="Enter a name"
          value={dateToUpdate.name}
          onChange={handleInputChange}
        />
        <input
          className="form-input"
          type="text"
          name="surname"
          placeholder="Enter a surname"
          value={dateToUpdate.surname}
          onChange={handleInputChange}
        />
        <input
          className="form-input"
          type="date"
          name="date"
          value={dateToUpdate.date.split("T")[0]}
          onChange={handleInputChange}
        />
        <label>
          Family
          <input
            className="form-input"
            type="checkbox"
            name="family"
            checked={dateToUpdate.family}
            onChange={handleInputChange}
          />
          <span>?</span>
        </label>
        <textarea
          name="comment"
          placeholder="Add a comment"
          value={dateToUpdate.comment}
          onChange={handleInputChange}
        />

        <button type="submit">Update</button>
        <button type="button" onClick={onCancel}>
          Annuler
        </button>

        {showConfirm ? (
          <>
            <p>Êtes-vous sûr de vouloir supprimer cette date ?</p>
            <button type="button" onClick={handleDeleteDate}>
              Confirm
            </button>
            <button type="button" onClick={handleCancelDelete}>
              Cancel
            </button>
          </>
        ) : (
          <div>
            <span>Voulez supprimer cette date ?</span>
            <button type="button" onClick={handleShowConfirm}>
              Delete
            </button>
          </div>
        )}
      </form>
    </div>
  );
};

export default UpdateDate;
