import React, { useState, useEffect } from "react";
import apiHandler from "../../api/apiHandler";
import DatePickerMobile from "./DatePickerMobile";
import "../connect/authpage.css";
import "./css/updateDate.css";

const UpdateDate = ({ date, onCancel, onSaved, onDeleted, onMerge, compact = false }) => {
  const [dateToUpdate, setDateToUpdate] = useState(date);
  const [showConfirm, setShowConfirm] = useState(false);

  const isFriend = !!date.linkedUser;

  useEffect(() => {
    apiHandler
      .get(`/date/${date._id}`)
      .then((response) => setDateToUpdate(response.data))
      .catch((error) => console.error(error));
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
      onSaved ? onSaved(dateToUpdate) : onCancel();
    } catch (error) {
      console.error(error);
    }
  };

  const handleDeleteDate = async () => {
    try {
      await apiHandler.delete(`/date/${date._id}`);
      onDeleted ? onDeleted() : onCancel();
    } catch (error) {
      console.error(error);
    }
  };

  const panel = (
    <div className="auth-panel">
      <div className="auth-panel-header">
        <h2 className="auth-title">Modifier la date</h2>
        <p className="auth-sub">
          {dateToUpdate.name} {dateToUpdate.surname}
        </p>
      </div>

      <form onSubmit={handleUpdateDate} className="auth-form">
        <div className="auth-row">
          <div className="auth-field">
            <label className="auth-label">Prénom</label>
            <input
              type="text"
              className="auth-input"
              name="name"
              placeholder="Prénom"
              value={dateToUpdate.name}
              onChange={handleInputChange}
            />
          </div>
          <div className="auth-field">
            <label className="auth-label">Nom</label>
            <input
              type="text"
              className="auth-input"
              name="surname"
              placeholder="Nom"
              value={dateToUpdate.surname}
              onChange={handleInputChange}
            />
          </div>
        </div>

        <div className="auth-field">
          <label className="auth-label">Date d'anniversaire</label>
          <DatePickerMobile
            value={dateToUpdate.date.split("T")[0]}
            onChange={(val) =>
              setDateToUpdate({ ...dateToUpdate, date: val })
            }
          />
        </div>

        {!isFriend && (
          <div className="auth-field">
            <label className="auth-label">Date de fête (optionnel)</label>
            <input
              type="text"
              className="auth-input"
              name="nameday"
              placeholder="MM-JJ (ex: 03-13)"
              value={dateToUpdate.nameday || ""}
              onChange={handleInputChange}
              maxLength={5}
            />
            <span className="auth-input-hint">
              Format MM-JJ — exemple : 03-13 pour le 13 mars
            </span>
          </div>
        )}

        <div className="auth-field auth-checkbox-field">
          <label className="auth-checkbox-label">
            <input
              type="checkbox"
              name="family"
              checked={dateToUpdate.family}
              onChange={handleInputChange}
              className="auth-checkbox"
            />
            <span className="auth-checkbox-text">Famille</span>
          </label>
        </div>

        {/* ── ACTIONS PRINCIPALES ── */}
        <div className="update-actions">
          <button type="submit" className="auth-btn-primary">
            Enregistrer
          </button>
          <button
            type="button"
            className="update-btn-secondary"
            onClick={onCancel}
          >
            Annuler
          </button>
          {!isFriend && onMerge && (
            <button
              type="button"
              className="update-btn-merge"
              onClick={() => onMerge(date)}
            >
              Fusionner avec un ami
            </button>
          )}
        </div>

        {/* ── SUPPRESSION ── */}
        <div className="update-delete-zone">
          {!showConfirm ? (
            <button
              type="button"
              className="update-btn-delete-trigger"
              onClick={() => setShowConfirm(true)}
            >
              Supprimer cette date
            </button>
          ) : (
            <div className="update-confirm-delete">
              <p className="update-confirm-text">
                Cette action est irréversible. Confirmer la suppression ?
              </p>
              <div className="update-confirm-actions">
                <button
                  type="button"
                  className="update-btn-danger"
                  onClick={handleDeleteDate}
                >
                  Supprimer
                </button>
                <button
                  type="button"
                  className="update-btn-secondary"
                  onClick={() => setShowConfirm(false)}
                >
                  Annuler
                </button>
              </div>
            </div>
          )}
        </div>
      </form>
    </div>
  );

  // ── Mode compact : dans FriendProfile ──
  if (compact) {
    return (
      <div className="update-compact-wrapper">
        {panel}
      </div>
    );
  }

  // ── Mode standalone : page dédiée ──
  return (
    <div className="auth-page">
      <div className="auth-shell auth-shell-update">
        {panel}
      </div>
    </div>
  );
};

export default UpdateDate;