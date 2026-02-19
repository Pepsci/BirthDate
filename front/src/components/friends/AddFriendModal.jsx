import React, { useState } from "react";
import apiHandler from "../../api/apiHandler";
import "./css/addFriendModal.css";

const AddFriendModal = ({
  isOpen = false, // 👈 VALEUR PAR DÉFAUT
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

      // ✅ Message adapté selon le type de réponse
      if (response.type === "invitation_sent") {
        setSuccess(
          "Invitation envoyée par email ! 📧 Votre ami sera ajouté automatiquement à son inscription.",
        );
      } else {
        setSuccess("Demande d'amitié envoyée ! 🎉");
        // ✅ Callback uniquement si c'est une demande d'amitié (pas une invitation)
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

      if (error.response?.data?.message) {
        setError(error.response.data.message);
      } else {
        setError("Erreur lors de l'envoi de la demande");
      }
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

  // 👇 NE PAS AFFICHER SI isOpen = false
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>👥 Ajouter un ami</h2>
          <button className="modal-close" onClick={handleClose}>
            ✕
          </button>
        </div>

        <div className="modal-body">
          <p className="modal-description">
            Entrez l'email de votre ami. Il recevra une invitation pour accepter
            votre demande.
          </p>

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="friendEmail">Email de votre ami</label>
              <input
                id="friendEmail"
                type="email"
                className="form-input"
                placeholder="exemple@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
                autoFocus
              />
            </div>

            {error && <div className="alert alert-error">⚠️ {error}</div>}

            {success && <div className="alert alert-success">✅ {success}</div>}

            <div className="modal-actions">
              <button
                type="button"
                className="btn-modal btn-cancel"
                onClick={handleClose}
                disabled={isLoading}
              >
                Annuler
              </button>
              <button
                type="submit"
                className="btn-modal btn-submit"
                disabled={isLoading}
              >
                {isLoading ? "Envoi..." : "Envoyer l'invitation"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AddFriendModal;
