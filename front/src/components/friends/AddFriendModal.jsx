import React, { useState } from "react";
import apiHandler from "../../api/apiHandler";
import "./css/addFriendModal.css";

const AddFriendModal = ({
  isOpen = false,
  onClose,
  currentUserId,
  onFriendAdded,
}) => {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!email.trim()) {
      setError("Veuillez entrer un email");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError("Email invalide");
      return;
    }

    setIsLoading(true);

    try {
      const response = await apiHandler.sendFriendRequest(currentUserId, email);

      if (response.type === "invitation_sent") {
        setSuccess(
          "Invitation envoyée par email ! Votre ami sera ajouté automatiquement à son inscription.",
        );
      } else {
        setSuccess("Demande d'amitié envoyée !");
        if (onFriendAdded && response.friendship) {
          onFriendAdded(response.friendship);
        }
      }

      setEmail("");
      setTimeout(() => {
        onClose();
        setSuccess("");
      }, 2500);
    } catch (error) {
      console.error("Erreur:", error);
      setError(
        error.response?.data?.message || "Erreur lors de l'envoi de la demande",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setEmail("");
    setError("");
    setSuccess("");
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="friend-modal-overlay" onClick={handleClose}>
      <div className="friend-modal" onClick={(e) => e.stopPropagation()}>
        <div className="friend-modal-header">
          <div>
            <h2 className="friend-modal-title">Ajouter un ami</h2>
            <p className="friend-modal-sub">
              Votre ami recevra une invitation pour accepter votre demande
            </p>
          </div>
          <button className="friend-modal-close" onClick={handleClose}>
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="friend-modal-body">
          <div className="auth-field">
            <label className="auth-label">Email de votre ami</label>
            <input
              id="friendEmail"
              type="email"
              className="auth-input"
              placeholder="vous@exemple.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading}
              autoFocus
            />
          </div>

          {error && <p className="auth-msg auth-msg--error">{error}</p>}
          {success && <p className="auth-msg auth-msg--success">{success}</p>}

          <div className="friend-modal-actions">
            <button
              type="button"
              className="update-btn-secondary"
              onClick={handleClose}
              disabled={isLoading}
            >
              Annuler
            </button>
            <button
              type="submit"
              className="auth-btn-primary"
              disabled={isLoading}
            >
              {isLoading ? "Envoi..." : "Envoyer l'invitation"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddFriendModal;
