import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import useAuth from "../../context/useAuth";
import apiHandler from "../../api/apiHandler";
import "./css/mergeDuplicates.css";

const MergeDuplicates = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  const [duplicates, setDuplicates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [merging, setMerging] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!currentUser) {
      navigate("/login");
      return;
    }
    loadDuplicates();
  }, [currentUser, navigate]);

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

  const handleMerge = async (friendCardId, manualCardId) => {
    if (
      !window.confirm(
        "Voulez-vous fusionner ces cartes ?\n\n" +
          "• Vos idées cadeaux seront ajoutées à la carte ami\n" +
          "• La carte manuelle sera supprimée\n" +
          "• La wishlist de votre ami sera conservée",
      )
    ) {
      return;
    }

    try {
      setMerging(true);

      await apiHandler.post("/merge-dates/merge", {
        friendCardId,
        manualCardId,
        userId: currentUser._id,
      });

      alert("✅ Fusion réussie !");

      // Recharger les doublons
      await loadDuplicates();
    } catch (err) {
      console.error("Erreur fusion:", err);
      alert("❌ Erreur lors de la fusion");
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

      // Recharger
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
      <div className="merge-duplicates-page">
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>Détection des doublons...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="merge-duplicates-page">
        <div className="error-state">
          <p>{error}</p>
          <button onClick={loadDuplicates} className="btn-retry">
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="merge-duplicates-page">
      <div className="merge-header">
        <h1>🔄 Fusion des cartes en double</h1>
        <button className="btn-back" onClick={() => navigate("/profile")}>
          ← Retour au profil
        </button>
      </div>

      {duplicates.length === 0 ? (
        <div className="empty-state">
          <h2>✅ Aucun doublon détecté</h2>
          <p>Toutes vos cartes sont uniques !</p>
        </div>
      ) : (
        <>
          <div className="merge-summary">
            <p>
              <strong>{duplicates.length}</strong> doublon
              {duplicates.length > 1 ? "s" : ""} détecté
              {duplicates.length > 1 ? "s" : ""}
            </p>
            {duplicates.length > 1 && (
              <button
                className="btn-merge-all"
                onClick={handleMergeAll}
                disabled={merging}
              >
                ⚡ Tout fusionner automatiquement
              </button>
            )}
          </div>

          <div className="duplicates-list">
            {duplicates.map((duplicate, index) => (
              <div key={index} className="duplicate-group">
                <h3 className="group-title">
                  {duplicate.friendCard.name} {duplicate.friendCard.surname}
                </h3>

                <div className="cards-comparison">
                  {/* Carte Ami (destination) */}
                  <div className="card-preview friend-card">
                    <div className="card-badge">✅ Carte Ami (à conserver)</div>
                    <h4>
                      {duplicate.friendCard.name} {duplicate.friendCard.surname}
                    </h4>
                    <p className="card-date">
                      📅{" "}
                      {new Date(duplicate.friendCard.date).toLocaleDateString(
                        "fr-FR",
                      )}
                    </p>

                    <div className="card-details">
                      <div className="detail-section">
                        <h5>
                          🎁 Mes idées cadeaux (
                          {duplicate.friendCard.gifts.length})
                        </h5>
                        {duplicate.friendCard.gifts.length > 0 ? (
                          <ul>
                            {duplicate.friendCard.gifts
                              .slice(0, 3)
                              .map((gift, i) => (
                                <li key={i}>
                                  {gift.purchased ? "✅" : "⭕"} {gift.giftName}
                                </li>
                              ))}
                            {duplicate.friendCard.gifts.length > 3 && (
                              <li className="more">
                                + {duplicate.friendCard.gifts.length - 3}{" "}
                                autres...
                              </li>
                            )}
                          </ul>
                        ) : (
                          <p className="empty">Aucune idée</p>
                        )}
                      </div>

                      <div className="detail-section">
                        <h5>
                          💝 Sa wishlist ({duplicate.friendCard.wishlist.length}
                          )
                        </h5>
                        {duplicate.friendCard.wishlist.length > 0 ? (
                          <ul>
                            {duplicate.friendCard.wishlist
                              .slice(0, 3)
                              .map((item, i) => (
                                <li key={i}>
                                  {item.isPurchased ? "✅" : "⭕"} {item.title}
                                  {item.price && ` (${item.price}€)`}
                                </li>
                              ))}
                            {duplicate.friendCard.wishlist.length > 3 && (
                              <li className="more">
                                + {duplicate.friendCard.wishlist.length - 3}{" "}
                                autres...
                              </li>
                            )}
                          </ul>
                        ) : (
                          <p className="empty">Wishlist vide</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Flèche de fusion */}
                  <div className="merge-arrow">
                    <span>➕</span>
                    <p>Fusionner</p>
                  </div>

                  {/* Cartes Manuelles (sources) */}
                  <div className="manual-cards">
                    {duplicate.manualCards.map((manualCard) => (
                      <div
                        key={manualCard._id}
                        className="card-preview manual-card"
                      >
                        <div className="card-badge">
                          📝 Carte Manuelle (à supprimer)
                        </div>
                        <h4>
                          {manualCard.name} {manualCard.surname}
                        </h4>
                        <p className="card-date">
                          📅{" "}
                          {new Date(manualCard.date).toLocaleDateString(
                            "fr-FR",
                          )}
                        </p>

                        <div className="card-details">
                          <div className="detail-section">
                            <h5>
                              🎁 Mes idées cadeaux ({manualCard.gifts.length})
                            </h5>
                            {manualCard.gifts.length > 0 ? (
                              <ul>
                                {manualCard.gifts.slice(0, 3).map((gift, i) => (
                                  <li key={i}>
                                    {gift.purchased ? "✅" : "⭕"}{" "}
                                    {gift.giftName}
                                  </li>
                                ))}
                                {manualCard.gifts.length > 3 && (
                                  <li className="more">
                                    + {manualCard.gifts.length - 3} autres...
                                  </li>
                                )}
                              </ul>
                            ) : (
                              <p className="empty">Aucune idée</p>
                            )}
                          </div>

                          {manualCard.comments?.length > 0 && (
                            <div className="detail-section">
                              <h5>
                                💬 Commentaires ({manualCard.comments.length})
                              </h5>
                            </div>
                          )}
                        </div>

                        <button
                          className="btn-merge"
                          onClick={() =>
                            handleMerge(
                              duplicate.friendCard._id,
                              manualCard._id,
                            )
                          }
                          disabled={merging}
                        >
                          {merging
                            ? "⏳ Fusion..."
                            : "🔄 Fusionner cette carte"}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default MergeDuplicates;
