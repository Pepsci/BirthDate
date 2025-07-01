import React, { useState, useEffect } from "react";
import useAuth from "../../context/useAuth";
import apiHandler from "../../api/apiHandler";
import "./css/notification.css";

const Notifications = () => {
  const { currentUser } = useAuth();
  const [dates, setDates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [updatingIds, setUpdatingIds] = useState(new Set());

  useEffect(() => {
    loadDates();
  }, [currentUser]);

  const loadDates = async () => {
    try {
      setLoading(true);
      const response = await apiHandler.get(`/date?owner=${currentUser._id}`);

      // Trier par nom alphabétique
      const sortedDates = response.data.sort((a, b) => {
        const nameA = `${a.name} ${a.surname}`.toLowerCase();
        const nameB = `${b.name} ${b.surname}`.toLowerCase();
        return nameA.localeCompare(nameB);
      });

      setDates(sortedDates);
    } catch (err) {
      setError("Erreur lors du chargement des dates");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Utilisation de la même méthode que dans FriendProfile
  const toggleNotifications = async (dateId, currentStatus) => {
    setUpdatingIds((prev) => new Set(prev).add(dateId));

    try {
      const newValue = !currentStatus;

      // Utilisation de la même méthode que FriendProfile qui fonctionne
      const updatedDate = await apiHandler.toggleDateNotifications(
        dateId,
        newValue
      );

      // Mettre à jour l'état local avec la réponse complète
      setDates((prevDates) =>
        prevDates.map((date) =>
          date._id === dateId
            ? { ...date, ...updatedDate } // Fusionner avec la réponse du serveur
            : date
        )
      );
    } catch (error) {
      console.error("Failed to update notification preference:", error);

      // En cas d'erreur, recharger les données pour avoir l'état correct
      loadDates();

      // Optionnel : afficher un message d'erreur temporaire
      setError("Erreur lors de la mise à jour. Données rechargées.");
      setTimeout(() => setError(null), 3000);
    } finally {
      setUpdatingIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(dateId);
        return newSet;
      });
    }
  };

  const enableAllNotifications = async () => {
    const datesToUpdate = dates.filter(
      (date) => date.receiveNotifications === false
    );

    if (datesToUpdate.length === 0) return;

    // Marquer tous les éléments comme en cours de mise à jour
    const idsToUpdate = datesToUpdate.map((date) => date._id);
    setUpdatingIds(new Set(idsToUpdate));

    try {
      // Utiliser la même méthode que le toggle individuel
      const promises = datesToUpdate.map((date) =>
        apiHandler.toggleDateNotifications(date._id, true)
      );

      const results = await Promise.all(promises);

      // Mettre à jour l'état local avec les réponses du serveur
      setDates((prevDates) =>
        prevDates.map((date) => {
          const updatedResult = results.find(
            (result) => result._id === date._id
          );
          return updatedResult ? { ...date, ...updatedResult } : date;
        })
      );
    } catch (err) {
      console.error("Erreur lors de l'activation globale:", err);
      // Recharger en cas d'erreur
      loadDates();
    } finally {
      setUpdatingIds(new Set());
    }
  };

  const disableAllNotifications = async () => {
    const datesToUpdate = dates.filter(
      (date) => date.receiveNotifications !== false
    );

    if (datesToUpdate.length === 0) return;

    const idsToUpdate = datesToUpdate.map((date) => date._id);
    setUpdatingIds(new Set(idsToUpdate));

    try {
      const promises = datesToUpdate.map((date) =>
        apiHandler.toggleDateNotifications(date._id, false)
      );

      const results = await Promise.all(promises);

      setDates((prevDates) =>
        prevDates.map((date) => {
          const updatedResult = results.find(
            (result) => result._id === date._id
          );
          return updatedResult ? { ...date, ...updatedResult } : date;
        })
      );
    } catch (err) {
      console.error("Erreur lors de la désactivation globale:", err);
      loadDates();
    } finally {
      setUpdatingIds(new Set());
    }
  };

  if (loading) {
    return (
      <div className="simple-notification-manager">
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>Chargement des notifications...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="simple-notification-manager">
        <div className="error-state">
          <p>{error}</p>
          <button onClick={loadDates} className="retry-button">
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  const activeCount = dates.filter(
    (date) => date.receiveNotifications !== false
  ).length;
  const totalCount = dates.length;

  return (
    <div className="simple-notification-manager">
      {/* En-tête avec statistiques */}
      <div className="notification-header">
        <h2>🔔 Gestion des Notifications</h2>
        <div className="notification-summary">
          <span className="summary-text">
            {activeCount} sur {totalCount} personnes recevront des notifications
          </span>
        </div>
      </div>

      {/* Actions globales */}
      <div className="global-actions">
        <button
          onClick={enableAllNotifications}
          className="action-button enable-all"
          disabled={activeCount === totalCount || updatingIds.size > 0}
        >
          ✅ Activer tout
        </button>
        <button
          onClick={disableAllNotifications}
          className="action-button disable-all"
          disabled={activeCount === 0 || updatingIds.size > 0}
        >
          ❌ Désactiver tout
        </button>
      </div>

      {/* Liste des personnes */}
      <div className="notification-list">
        {dates.length === 0 ? (
          <div className="empty-state">
            <p>Aucune date d'anniversaire trouvée</p>
          </div>
        ) : (
          dates.map((date) => {
            const isUpdating = updatingIds.has(date._id);
            const isEnabled = date.receiveNotifications !== false;

            return (
              <div
                key={date._id}
                className={`notification-item ${
                  isEnabled ? "enabled" : "disabled"
                } ${isUpdating ? "updating" : ""}`}
              >
                <div className="person-info">
                  <div className="person-name">
                    <span className="name">{date.name}</span>
                    <span className="surname">{date.surname}</span>
                  </div>
                  <div className="person-details">
                    <span className="birth-date">
                      {new Date(date.date).toLocaleDateString("fr-FR")}
                    </span>
                    {date.family && (
                      <span className="family-badge">👨‍👩‍👧‍👦 Famille</span>
                    )}
                  </div>
                </div>

                <div className="notification-toggle">
                  {/* Utilisation du même pattern que FriendProfile */}
                  <label className="switch">
                    <input
                      type="checkbox"
                      checked={isEnabled}
                      onChange={() => toggleNotifications(date._id, isEnabled)}
                      disabled={isUpdating}
                    />
                    <span className="slider round"></span>
                  </label>
                  <span
                    className={`status-text ${
                      isEnabled ? "enabled" : "disabled"
                    }`}
                  >
                    {isUpdating ? (
                      <span className="updating-text">
                        <span className="mini-spinner"></span>
                        Mise à jour...
                      </span>
                    ) : isEnabled ? (
                      "Activé"
                    ) : (
                      "Désactivé"
                    )}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer avec informations */}
      <div className="notification-footer">
        <p className="info-text">
          💡 Les notifications vous rappelleront les anniversaires à venir selon
          vos préférences.
        </p>
      </div>
    </div>
  );
};

export default Notifications;
