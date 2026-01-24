// components/dashboard/ManualMergeModal.jsx
import React, { useState, useEffect } from "react";
import useAuth from "../../context/useAuth";
import apiHandler from "../../api/apiHandler";
import "./css/manualmergemodal.css";

const ManualMergeModal = ({ sourceCard, onClose, onMergeSuccess }) => {
  const { currentUser } = useAuth();
  const [allCards, setAllCards] = useState([]);
  const [selectedTargetCard, setSelectedTargetCard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [merging, setMerging] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false); // 👈 AJOUTÉ

  useEffect(() => {
    loadAllCards();
  }, []);

  const loadAllCards = async () => {
    try {
      setLoading(true);
      const response = await apiHandler.get(`/date?owner=${currentUser._id}`);

      // Filtrer : garder seulement les cartes AMI (avec linkedUser) et exclure la carte source
      const friendCards = response.data.filter(
        (card) => card.linkedUser && card._id !== sourceCard._id,
      );

      setAllCards(friendCards);
    } catch (err) {
      console.error("Erreur chargement cartes:", err);
    } finally {
      setLoading(false);
    }
  };

  // 👇 MODIFIÉ - Ouvrir la confirmation au lieu de window.confirm
  const handleMergeClick = () => {
    if (!selectedTargetCard) return;
    setShowConfirmation(true);
  };

  // 👇 AJOUTÉ - Fonction de fusion après confirmation
  const handleConfirmMerge = async () => {
    try {
      setMerging(true);

      await apiHandler.post("/merge-dates/merge", {
        friendCardId: selectedTargetCard._id,
        manualCardId: sourceCard._id,
        userId: currentUser._id,
      });

      if (onMergeSuccess) {
        onMergeSuccess();
      }

      onClose();
    } catch (err) {
      console.error("Erreur fusion:", err);
      alert(
        "❌ Erreur lors de la fusion: " +
          (err.response?.data?.message || err.message),
      );
    } finally {
      setMerging(false);
    }
  };

  // 👇 AJOUTÉ - Vue de confirmation
  if (showConfirmation) {
    return (
      <div className="manual-merge-overlay">
        <div className="manual-merge-modal">
          <div className="manual-merge-header">
            <h3>🔄 Confirmer la fusion</h3>
            <button
              className="close-btn"
              onClick={() => setShowConfirmation(false)}
              disabled={merging}
            >
              ✕
            </button>
          </div>

          <div className="manual-merge-body">
            <div className="confirmation-content">
              <h2>Fusionner ces deux cartes ?</h2>

              <div className="confirmation-cards">
                <div className="confirmation-card source">
                  <div className="card-label">Carte à supprimer</div>
                  <h3>
                    {sourceCard.name} {sourceCard.surname}
                  </h3>
                  <p>
                    📅 {new Date(sourceCard.date).toLocaleDateString("fr-FR")}
                  </p>
                  <p>🎁 {sourceCard.gifts?.length || 0} idées cadeaux</p>
                </div>

                <div className="arrow-right">→</div>

                <div className="confirmation-card target">
                  <div className="card-label">Carte à conserver</div>
                  <h3>
                    {selectedTargetCard.name} {selectedTargetCard.surname}
                  </h3>
                  <p>
                    📅{" "}
                    {new Date(selectedTargetCard.date).toLocaleDateString(
                      "fr-FR",
                    )}
                  </p>
                  <p>
                    🎁 {selectedTargetCard.gifts?.length || 0} idées cadeaux
                    actuelles
                  </p>
                </div>
              </div>

              <div className="confirmation-info">
                <div className="info-item">
                  ✅ Les idées cadeaux de la carte manuelle seront ajoutées
                </div>
                <div className="info-item">✅ La carte ami sera conservée</div>
                <div className="info-item">
                  ⚠️ La carte manuelle sera supprimée
                </div>
              </div>
            </div>
          </div>

          <div className="manual-merge-footer">
            <button
              className="btn-cancel"
              onClick={() => setShowConfirmation(false)}
              disabled={merging}
            >
              ← Retour
            </button>
            <button
              className="btn-merge"
              onClick={handleConfirmMerge}
              disabled={merging}
            >
              {merging ? "⏳ Fusion en cours..." : "✅ Confirmer la fusion"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Vue principale (sélection de carte)
  return (
    <div className="manual-merge-overlay">
      <div className="manual-merge-modal">
        <div className="manual-merge-header">
          <h3>🔄 Fusionner avec une carte ami</h3>
          <button className="close-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="manual-merge-body">
          <div className="source-card-info">
            <h4>Carte à fusionner (sera supprimée) :</h4>
            <div className="card-preview-small">
              <p>
                <strong>
                  {sourceCard.name} {sourceCard.surname}
                </strong>
              </p>
              <p>📅 {new Date(sourceCard.date).toLocaleDateString("fr-FR")}</p>
              <p>🎁 {sourceCard.gifts?.length || 0} idées cadeaux</p>
            </div>
          </div>

          <div className="arrow-down">⬇️</div>

          <div className="target-selection">
            <h4>Choisir la carte ami (sera conservée) :</h4>

            {loading ? (
              <p className="loading-text">Chargement...</p>
            ) : allCards.length === 0 ? (
              <p className="no-cards">
                Aucune carte ami disponible pour la fusion.
              </p>
            ) : (
              <div className="cards-list">
                {allCards.map((card) => (
                  <div
                    key={card._id}
                    className={`card-option ${selectedTargetCard?._id === card._id ? "selected" : ""}`}
                    onClick={() => setSelectedTargetCard(card)}
                  >
                    <div className="card-option-info">
                      <p className="card-option-name">
                        <strong>
                          {card.name} {card.surname}
                        </strong>
                      </p>
                      <p className="card-option-date">
                        📅 {new Date(card.date).toLocaleDateString("fr-FR")}
                      </p>
                      <p className="card-option-gifts">
                        🎁 {card.gifts?.length || 0} idées cadeaux actuelles
                      </p>
                    </div>
                    {selectedTargetCard?._id === card._id && (
                      <div className="selected-check">✓</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="manual-merge-footer">
          <button className="btn-cancel" onClick={onClose}>
            Annuler
          </button>
          <button
            className="btn-merge"
            onClick={handleMergeClick}
            disabled={!selectedTargetCard}
          >
            🔄 Continuer
          </button>
        </div>
      </div>
    </div>
  );
};

export default ManualMergeModal;
