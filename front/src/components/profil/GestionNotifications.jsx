import React, { useState, useEffect } from "react";
import apiHandler from "../../api/apiHandler";
import "./css/gestionNotifications.css";

const GestionNotification = () => {
  // ✅ Plus besoin de currentUser - le backend gère tout

  const [dates, setDates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [updatingDates, setUpdatingDates] = useState(new Set());

  // 👇 MODIFIÉ : false pour que la liste soit cachée par défaut
  const [isListExpanded, setIsListExpanded] = useState(false);

  const [userEmailPreference, setUserEmailPreference] = useState(true);
  const [loadingUserPref, setLoadingUserPref] = useState(false);

  useEffect(() => {
    // ✅ Plus besoin de vérifier currentUser
    // Le backend gère l'authentification
    loadDates();
    loadUserEmailPreference();
  }, []);

  const loadDates = async () => {
    try {
      setLoading(true);
      // ✅ SIMPLIFIÉ : Le backend filtre automatiquement par utilisateur authentifié
      // Plus besoin de passer l'ID en paramètre
      const response = await apiHandler.get("/date");
      setDates(response.data);
      setError(null);
    } catch (err) {
      console.error("Erreur chargement dates:", err);
      setError("Impossible de charger les anniversaires");
    } finally {
      setLoading(false);
    }
  };

  const loadUserEmailPreference = async () => {
    try {
      // ✅ Le backend sait qui est l'utilisateur via le token JWT
      const response = await apiHandler.get("/users/me");
      setUserEmailPreference(response.data.receiveBirthdayEmails !== false);
    } catch (err) {
      console.error("Erreur chargement préférences:", err);
    }
  };

  const handleToggleNotification = async (dateId, currentValue) => {
    setUpdatingDates((prev) => new Set(prev).add(dateId));

    try {
      const updatedDate = await apiHandler.toggleDateNotifications(
        dateId,
        !currentValue,
      );

      setDates((prevDates) =>
        prevDates.map((d) => (d._id === dateId ? updatedDate : d)),
      );
    } catch (err) {
      console.error("Erreur toggle notification:", err);
    } finally {
      setUpdatingDates((prev) => {
        const newSet = new Set(prev);
        newSet.delete(dateId);
        return newSet;
      });
    }
  };

  const handleEnableAll = async () => {
    try {
      const dateIds = dates.map((d) => d._id);
      setUpdatingDates(new Set(dateIds));

      await apiHandler.bulkUpdateNotifications(dateIds, true);
      await loadDates();
    } catch (err) {
      console.error("Erreur activation:", err);
    } finally {
      setUpdatingDates(new Set());
    }
  };

  const handleDisableAll = async () => {
    try {
      const dateIds = dates.map((d) => d._id);
      setUpdatingDates(new Set(dateIds));

      await apiHandler.bulkUpdateNotifications(dateIds, false);
      await loadDates();
    } catch (err) {
      console.error("Erreur désactivation:", err);
    } finally {
      setUpdatingDates(new Set());
    }
  };

  const handleToggleUserEmailPreference = async (newValue) => {
    setLoadingUserPref(true);
    try {
      // ✅ Le backend sait qui est l'utilisateur
      await apiHandler.patch("/users/me", {
        receiveBirthdayEmails: newValue,
      });
      setUserEmailPreference(newValue);
    } catch (err) {
      console.error("Erreur mise à jour préférence email:", err);
    } finally {
      setLoadingUserPref(false);
    }
  };

  const activeCount = dates.filter(
    (d) => d.receiveNotifications !== false,
  ).length;
  const totalCount = dates.length;

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
          <button className="retry-button" onClick={loadDates}>
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="simple-notification-manager">
      {/* Header */}
      <div className="notification-header">
        <h2>Gestion des notifications</h2>
        <div className="notification-summary">
          <span className="summary-text">
            {activeCount} sur {totalCount} de notifications activé
          </span>
        </div>
      </div>

      {/* Préférences globales email */}
      <div className="user-email-preferences-simple">
        <div className="user-pref-toggle-simple">
          <div className="toggle-info">
            <span className="toggle-label">
              Recevoir les emails de notifications
            </span>
          </div>
          <label className="switch">
            <input
              type="checkbox"
              checked={userEmailPreference}
              onChange={(e) =>
                handleToggleUserEmailPreference(e.target.checked)
              }
              disabled={loadingUserPref}
            />
            <span className="slider round"></span>
          </label>
        </div>

        {!userEmailPreference && (
          <div className="warning-simple">
            ⚠️ Les emails sont désactivés. Vous ne recevrez aucune notification
            par email, même pour les anniversaires activés ci-dessous.
          </div>
        )}
      </div>

      {/* Bouton toggle pour replier/déplier */}
      <div className="list-toggle-section">
        <button
          className="toggle-list-btn"
          onClick={() => setIsListExpanded(!isListExpanded)}
        >
          <span className="toggle-icon">{isListExpanded ? "▼" : "▶"}</span>
          <span className="toggle-text">
            {isListExpanded ? "Masquer la liste" : "Afficher la liste"}
          </span>
          <span className="toggle-count">({totalCount})</span>
        </button>
      </div>

      {/* Contenu collapsible (filtre + actions + liste) */}
      {isListExpanded && (
        <div className="collapsible-content">
          {/* Filtres */}
          <div className="filter-section">
            <h3>Filtrer les anniversaires</h3>
            <div className="filter-inputs">
              <input
                type="text"
                placeholder="Prénom..."
                className="filter-input"
              />
              <input
                type="text"
                placeholder="Nom..."
                className="filter-input"
              />
            </div>
            <div className="filter-buttons">
              <button className="filter-btn">Famille uniquement</button>
              <button className="filter-btn">Effacer les filtres</button>
            </div>
          </div>

          {/* Actions globales */}
          <div className="global-actions">
            <button
              className="action-button enable-all"
              onClick={handleEnableAll}
              disabled={updatingDates.size > 0}
            >
              ✓ Activer tout
            </button>
            <button
              className="action-button disable-all"
              onClick={handleDisableAll}
              disabled={updatingDates.size > 0}
            >
              ✕ Désactiver tout
            </button>
          </div>

          {/* Liste des notifications */}
          <div className="notification-list">
            {dates.length === 0 ? (
              <div className="empty-state">
                <p>Aucun anniversaire à afficher</p>
              </div>
            ) : (
              dates.map((date) => {
                const isUpdating = updatingDates.has(date._id);
                const isEnabled = date.receiveNotifications !== false;
                const isUserDisabled = !userEmailPreference;

                return (
                  <div
                    key={date._id}
                    className={`notification-item ${
                      isEnabled ? "enabled" : "disabled"
                    } ${isUpdating ? "updating" : ""} ${
                      isUserDisabled ? "user-disabled" : ""
                    }`}
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
                        {date.famille && (
                          <span className="family-badge">Famille</span>
                        )}
                      </div>
                    </div>

                    <div className="notification-toggle">
                      {isUpdating ? (
                        <div className="updating-text">
                          <div className="mini-spinner"></div>
                          <span>Mise à jour...</span>
                        </div>
                      ) : (
                        <>
                          <label className="switch">
                            <input
                              type="checkbox"
                              checked={isEnabled}
                              onChange={() =>
                                handleToggleNotification(date._id, isEnabled)
                              }
                              disabled={isUserDisabled}
                            />
                            <span className="slider round"></span>
                          </label>
                          <span
                            className={`status-text ${
                              isEnabled ? "enabled" : "disabled"
                            }`}
                          >
                            {isEnabled ? "Activé" : "Désactivé"}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="notification-footer">
        <p className="info-text">
          Les notifications actives recevront des rappels par email.
        </p>
      </div>
    </div>
  );
};

export default GestionNotification;
