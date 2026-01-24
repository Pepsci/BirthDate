import React, { useState, useEffect } from "react";
import useAuth from "../../context/useAuth";
import apiHandler from "../../api/apiHandler";
import "./css/mergeduplicatessection.css";

const MergeDuplicatesSection = () => {
  const { currentUser } = useAuth();

  const [duplicates, setDuplicates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [merging, setMerging] = useState(false);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [modalData, setModalData] = useState(null);

  useEffect(() => {
    if (currentUser) {
      loadDuplicates();
    }
  }, [currentUser]);

  const loadDuplicates = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await apiHandler.get(
        `/merge-dates/detect/${currentUser._id}`,
      );
      setDuplicates(response.data.duplicates || []);
    } catch (err) {
      console.error("Erreur chargement doublons:", err);
      setError("Erreur lors du chargement des doublons");
    } finally {
      setLoading(false);
    }
  };

  const openMergeModal = (friendCard, manualCard) => {
    setModalData({ friendCard, manualCard });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setModalData(null);
  };

  const confirmMerge = async () => {
    if (!modalData) return;

    try {
      setMerging(true);

      await apiHandler.post("/merge-dates/merge", {
        friendCardId: modalData.friendCard._id,
        manualCardId: modalData.manualCard._id,
        userId: currentUser._id,
      });

      closeModal();
      await loadDuplicates();
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

  const handleMergeAll = async () => {
    if (
      !window.confirm(
        `Fusionner automatiquement ${duplicates.length} doublons ?\n\n` +
          "Toutes les cartes manuelles seront fusionnées avec leurs cartes amis correspondantes.",
      )
    ) {
      return;
    }

    try {
      setMerging(true);

      const response = await apiHandler.post(
        `/merge-dates/merge-all/${currentUser._id}`,
      );

      alert(`✅ ${response.data.mergedCount} fusions réussies !`);

      await loadDuplicates();
    } catch (err) {
      console.error("Erreur fusion globale:", err);
      alert("❌ Erreur lors de la fusion globale");
    } finally {
      setMerging(false);
    }
  };

  if (loading) {
    return (
      <div className="merge-section">
        <h3>🔄 Fusion des doublons</h3>
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>Détection des doublons...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="merge-section">
        <h3>🔄 Fusion des doublons</h3>
        <div className="error-state">
          <p>{error}</p>
          <button onClick={loadDuplicates} className="btn-retry">
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  if (duplicates.length === 0) {
    return (
      <div className="merge-section">
        <h3>🔄 Fusion des doublons</h3>
        <div className="empty-state-small">
          <p>✅ Aucun doublon détecté</p>
        </div>
      </div>
    );
  }

  return (
    <div className="merge-section">
      <div className="merge-section-header">
        <h3>🔄 Fusion des doublons</h3>
        <span className="duplicate-count">
          {duplicates.length} doublon{duplicates.length > 1 ? "s" : ""}
        </span>
      </div>

      {duplicates.length > 1 && (
        <button
          className="btn-merge-all-compact"
          onClick={handleMergeAll}
          disabled={merging}
        >
          ⚡ Tout fusionner
        </button>
      )}

      <div className="duplicates-compact-list">
        {duplicates.map((duplicate, index) => (
          <div key={index} className="duplicate-item-compact">
            <div className="duplicate-info">
              <h4>
                {duplicate.friendCard.name} {duplicate.friendCard.surname}
              </h4>
              <p className="duplicate-details">
                Carte ami : {duplicate.friendCard.gifts.length} idées +{" "}
                {duplicate.friendCard.wishlist.length} wishlist
              </p>
              {duplicate.manualCards.map((manualCard) => (
                <div key={manualCard._id} className="manual-info">
                  <p className="manual-details">
                    Carte manuelle : {manualCard.gifts.length} idées à fusionner
                  </p>
                  <button
                    className="btn-merge-compact"
                    onClick={() =>
                      openMergeModal(duplicate.friendCard, manualCard)
                    }
                    disabled={merging}
                  >
                    🔄 Fusionner
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Modal de confirmation */}
      {showModal && modalData && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Confirmer la fusion</h3>

            <div className="modal-body">
              <p>
                <strong>
                  {modalData.friendCard.name} {modalData.friendCard.surname}
                </strong>
              </p>

              <div className="modal-section">
                <h4>✅ Carte Ami (conservée)</h4>
                <ul>
                  <li>🎁 {modalData.friendCard.gifts.length} idées cadeaux</li>
                  <li>
                    💝 {modalData.friendCard.wishlist.length} items dans sa
                    wishlist
                  </li>
                </ul>
              </div>

              <div className="modal-arrow">➕</div>

              <div className="modal-section highlight">
                <h4>📝 Carte Manuelle (supprimée)</h4>
                <ul>
                  <li>
                    🎁 {modalData.manualCard.gifts.length} idées cadeaux à
                    ajouter
                  </li>
                </ul>
                {modalData.manualCard.gifts.length > 0 && (
                  <div className="gifts-preview">
                    {modalData.manualCard.gifts.map((gift, i) => (
                      <span key={i} className="gift-tag">
                        {gift.giftName}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="modal-info">
                <p>✔️ Vos idées cadeaux seront ajoutées à la carte ami</p>
                <p>✔️ La wishlist de votre ami sera conservée</p>
                <p>✔️ La carte manuelle sera supprimée</p>
              </div>
            </div>

            <div className="modal-actions">
              <button
                className="btn-cancel"
                onClick={closeModal}
                disabled={merging}
              >
                Annuler
              </button>
              <button
                className="btn-confirm"
                onClick={confirmMerge}
                disabled={merging}
              >
                {merging ? "⏳ Fusion..." : "✅ Confirmer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MergeDuplicatesSection;
