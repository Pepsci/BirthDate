import React, { useState, useEffect, useRef } from "react";
import apiHandler from "../../api/apiHandler";
import DatePickerMobile from "./DatePickerMobile";
import NamedayInput from "./NamedayInput";
import "../connect/authpage.css";
import "./css/namedayInput.css";
import "./css/updateDate.css";

const UpdateDate = ({
  date,
  onCancel,
  onSaved,
  onDeleted,
  onMerge,
  compact = false,
}) => {
  const [dateToUpdate, setDateToUpdate] = useState(date);
  const [showConfirm, setShowConfirm] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null);
  const confirmRef = useRef(null);
  const photoRef = useRef(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState("");

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
    setSaveStatus(null);
    try {
      await apiHandler.patch(`/date/${date._id}`, dateToUpdate);
      setSaveStatus("success");
      setTimeout(() => {
        setSaveStatus(null);
        onSaved ? onSaved(dateToUpdate) : onCancel();
      }, 1000);
    } catch (error) {
      console.error(error);
      setSaveStatus("error");
    }
  };

  const handlePhotoSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoError("");
    const localPreview = URL.createObjectURL(file);
    setPhotoPreview(localPreview);
    setUploadingPhoto(true);
    try {
      const fd = new FormData();
      fd.append("photo", file);
      const response = await apiHandler.patch(`/date/${date._id}/photo`, fd, {
        headers: { "content-type": "multipart/form-data" },
      });
      setDateToUpdate((prev) => ({ ...prev, photo: response.data.photo }));
      if (onSaved) onSaved(response.data);
    } catch (error) {
      console.error(error);
      setPhotoError("Impossible d'envoyer la photo. Réessaie.");
    } finally {
      setUploadingPhoto(false);
      URL.revokeObjectURL(localPreview);
      setPhotoPreview(null);
      if (photoRef.current) photoRef.current.value = "";
    }
  };

  const handlePhotoRemove = async () => {
    setPhotoError("");
    setUploadingPhoto(true);
    try {
      const fd = new FormData();
      fd.append("removePhoto", "true");
      const response = await apiHandler.patch(`/date/${date._id}/photo`, fd, {
        headers: { "content-type": "multipart/form-data" },
      });
      setDateToUpdate((prev) => ({ ...prev, photo: response.data.photo }));
      if (onSaved) onSaved(response.data);
    } catch (error) {
      console.error(error);
      setPhotoError("Impossible de supprimer la photo. Réessaie.");
    } finally {
      setUploadingPhoto(false);
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

  // Scroll vers la confirmation quand elle s'affiche
  const handleShowConfirm = () => {
    setShowConfirm(true);
    setTimeout(() => {
      confirmRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    }, 80);
  };

  const panel = (
    <div className="auth-panel auth-panel-update">
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
          {/* Wrapper qui isole le scroll du DatePicker */}
          <div
            className="date-picker-scroll-trap"
            onTouchMove={(e) => e.stopPropagation()}
          >
            <DatePickerMobile
              value={dateToUpdate.date.split("T")[0]}
              onChange={(val) =>
                setDateToUpdate({ ...dateToUpdate, date: val })
              }
            />
          </div>
        </div>

        {!isFriend && (
          <div className="auth-field photo-edit-field">
            <label className="auth-label">Photo (optionnel)</label>
            <div className="photo-edit">
              <img
                className="photo-edit__preview"
                src={
                  photoPreview ||
                  dateToUpdate.photo ||
                  "https://api.dicebear.com/8.x/bottts/svg?seed=" +
                    encodeURIComponent(dateToUpdate.name || "date")
                }
                alt=""
              />
              <div className="photo-edit__controls">
                <button
                  type="button"
                  className="photo-edit__btn"
                  onClick={() => photoRef.current?.click()}
                  disabled={uploadingPhoto}
                >
                  {uploadingPhoto ? "Envoi..." : "Changer la photo"}
                </button>
                {dateToUpdate.photo && (
                  <button
                    type="button"
                    className="photo-edit__btn photo-edit__btn--danger"
                    onClick={handlePhotoRemove}
                    disabled={uploadingPhoto}
                  >
                    Retirer
                  </button>
                )}
                <input
                  ref={photoRef}
                  type="file"
                  accept="image/png, image/jpeg, image/webp, image/gif"
                  onChange={handlePhotoSelect}
                  className="photo-edit__input"
                  hidden
                />
              </div>
              {photoError && (
                <span className="photo-edit__error">{photoError}</span>
              )}
            </div>
          </div>
        )}

        {!isFriend && (
          <div className="auth-field">
            <label className="auth-label">Date de fête (optionnel)</label>
            {/* Sélecteur mois + jour : le format MM-JJ n'a plus à être connu,
                et c'est le même composant qu'à la création (CreateDate). */}
            <NamedayInput
              value={dateToUpdate.nameday || ""}
              onChange={(mmdd) =>
                setDateToUpdate({ ...dateToUpdate, nameday: mmdd || null })
              }
            />
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

        {/* ── FEEDBACK ── */}
        {saveStatus === "success" && (
          <div className="auth-msg auth-msg--success update-save-feedback">
            ✓ Modifications enregistrées
          </div>
        )}
        {saveStatus === "error" && (
          <div className="auth-msg auth-msg--error update-save-feedback">
            Une erreur est survenue, réessaie.
          </div>
        )}

        {/* ── ACTIONS PRINCIPALES ── */}
        <div className="update-actions">
          <button
            type="submit"
            className="auth-btn-primary"
            disabled={saveStatus === "success"}
          >
            {saveStatus === "success" ? "Enregistré ✓" : "Enregistrer"}
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
        <div className="update-delete-zone" ref={confirmRef}>
          {!showConfirm ? (
            <button
              type="button"
              className="update-btn-delete-trigger"
              onClick={handleShowConfirm}
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
    return <div className="update-compact-wrapper">{panel}</div>;
  }

  // ── Mode standalone : page dédiée ──
  return (
    <div className="auth-page">
      <div className="auth-shell auth-shell-update">{panel}</div>
    </div>
  );
};

export default UpdateDate;
