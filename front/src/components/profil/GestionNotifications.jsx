import React, { useState, useEffect } from "react";
import useAuth from "../../context/useAuth";
import apiHandler from "../../api/apiHandler";
import DateFilter from "../dashboard/DateFilter";
import "./css/gestionNotifications.css";

const Notifications = () => {
  const { currentUser, setCurrentUser } = useAuth();
  const [dates, setDates] = useState([]);
  const [filteredDates, setFilteredDates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [updatingIds, setUpdatingIds] = useState(new Set());
  const [updatingUserPref, setUpdatingUserPref] = useState(false);

  // État local pour les préférences utilisateur
  const [userReceivesEmails, setUserReceivesEmails] = useState(
    currentUser?.receiveBirthdayEmails !== false
  );

  useEffect(() => {
    loadDates();
  }, [currentUser]);

  useEffect(() => {
    setUserReceivesEmails(currentUser?.receiveBirthdayEmails !== false);
  }, [currentUser]);

  const loadDates = async () => {
    try {
      setLoading(true);
      const response = await apiHandler.get(`/date?owner=${currentUser._id}`);

      const sortedDates = response.data.sort((a, b) => {
        const nameA = `${a.name} ${a.surname}`.toLowerCase();
        const nameB = `${b.name} ${b.surname}`.toLowerCase();
        return nameA.localeCompare(nameB);
      });

      setDates(sortedDates);
      setFilteredDates(sortedDates);
    } catch (err) {
      setError("Erreur lors du chargement des dates");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (
    nameSearch,
    surnameSearch,
    isFamilyFilterActive
  ) => {
    let filtered = dates;

    if (nameSearch.trim()) {
      filtered = filtered.filter((date) =>
        date.name.toLowerCase().startsWith(nameSearch.toLowerCase())
      );
    }

    if (surnameSearch.trim()) {
      filtered = filtered.filter((date) =>
        date.surname.toLowerCase().startsWith(surnameSearch.toLowerCase())
      );
    }

    if (isFamilyFilterActive) {
      filtered = filtered.filter((date) => date.family === true);
    }

    setFilteredDates(filtered);
  };

  // Fonction pour toggle les emails de l'utilisateur
  const toggleUserEmails = async () => {
    setUpdatingUserPref(true);
    const newValue = !userReceivesEmails;

    try {
      const response = await apiHandler.patch(`/users/${currentUser._id}`, {
        receiveBirthdayEmails: newValue,
      });

      setUserReceivesEmails(newValue);

      if (setCurrentUser) {
        setCurrentUser((prev) => ({
          ...prev,
          receiveBirthdayEmails: newValue,
        }));
      }
    } catch (error) {
      console.error("Erreur lors de la modification des emails:", error);
      setError("Erreur lors de la modification. Veuillez réessayer.");
      setTimeout(() => setError(null), 3000);
    } finally {
      setUpdatingUserPref(false);
    }
  };

  const toggleNotifications = async (dateId, currentStatus) => {
    setUpdatingIds((prev) => new Set(prev).add(dateId));

    try {
      const newValue = !currentStatus;
      const updatedDate = await apiHandler.toggleDateNotifications(
        dateId,
        newValue
      );

      setDates((prevDates) => {
        const newDates = prevDates.map((date) =>
          date._id === dateId ? { ...date, ...updatedDate } : date
        );

        const currentFilters = getCurrentFilters();
        applyFilters(newDates, currentFilters);

        return newDates;
      });

      setFilteredDates((prevFilteredDates) =>
        prevFilteredDates.map((date) =>
          date._id === dateId ? { ...date, ...updatedDate } : date
        )
      );
    } catch (error) {
      console.error("Failed to update notification preference:", error);
      loadDates();
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

  const getCurrentFilters = () => {
    return { nameSearch: "", surnameSearch: "", isFamilyFilterActive: false };
  };

  const applyFilters = (datesToFilter, filters) => {
    handleFilterChange(
      filters.nameSearch,
      filters.surnameSearch,
      filters.isFamilyFilterActive
    );
  };

  const enableAllNotifications = async () => {
    const datesToUpdate = dates.filter(
      (date) => date.receiveNotifications === false
    );

    if (datesToUpdate.length === 0) return;

    const idsToUpdate = datesToUpdate.map((date) => date._id);
    setUpdatingIds(new Set(idsToUpdate));

    try {
      const promises = datesToUpdate.map((date) =>
        apiHandler.toggleDateNotifications(date._id, true)
      );

      const results = await Promise.all(promises);

      setDates((prevDates) => {
        const newDates = prevDates.map((date) => {
          const updatedResult = results.find(
            (result) => result._id === date._id
          );
          return updatedResult ? { ...date, ...updatedResult } : date;
        });

        const currentFilters = getCurrentFilters();
        applyFilters(newDates, currentFilters);

        return newDates;
      });

      setFilteredDates((prevFilteredDates) =>
        prevFilteredDates.map((date) => {
          const updatedResult = results.find(
            (result) => result._id === date._id
          );
          return updatedResult ? { ...date, ...updatedResult } : date;
        })
      );
    } catch (err) {
      console.error("Erreur lors de l'activation globale:", err);
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

      setDates((prevDates) => {
        const newDates = prevDates.map((date) => {
          const updatedResult = results.find(
            (result) => result._id === date._id
          );
          return updatedResult ? { ...date, ...updatedResult } : date;
        });

        const currentFilters = getCurrentFilters();
        applyFilters(newDates, currentFilters);

        return newDates;
      });

      setFilteredDates((prevFilteredDates) =>
        prevFilteredDates.map((date) => {
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

  const activeCount = filteredDates.filter(
    (date) => date.receiveNotifications !== false
  ).length;
  const totalCount = filteredDates.length;
  const totalOriginalCount = dates.length;

  return (
    <div className="simple-notification-manager">
      {/* En-tête avec statistiques */}
      <div className="notification-header">
        <h2>🔔 Gestion des Notifications</h2>
        <div className="notification-summary">
          <span className="summary-text">
            {activeCount} sur {totalCount} personnes recevront des notifications
            {totalCount !== totalOriginalCount && (
              <span className="filter-info">
                {" "}
                (sur {totalOriginalCount} au total)
              </span>
            )}
          </span>
        </div>
      </div>

      {/* Section des préférences globales des emails - Design simplifié */}
      <div className="user-email-preferences-simple">
        <div className="user-pref-toggle-simple">
          <div className="toggle-info">
            <span className="toggle-label">
              Recevoir les emails d'anniversaire
            </span>
            <span className="toggle-sublabel">
              {userReceivesEmails ? "Actif" : "Désactivé"}
            </span>
          </div>
          <label className="switch">
            <input
              type="checkbox"
              checked={userReceivesEmails}
              onChange={toggleUserEmails}
              disabled={updatingUserPref}
            />
            <span className="slider round"></span>
          </label>
        </div>

        {!userReceivesEmails && (
          <div className="warning-simple">
            Les notifications individuelles ci-dessous ne fonctionneront pas
            tant que cette option est désactivée
          </div>
        )}
      </div>

      {/* Composant de filtrage */}
      <DateFilter onFilterChange={handleFilterChange} />

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
        {filteredDates.length === 0 ? (
          <div className="empty-state">
            <p>
              {dates.length === 0
                ? "Aucune date d'anniversaire trouvée"
                : "Aucune date ne correspond aux critères de filtrage"}
            </p>
          </div>
        ) : (
          filteredDates.map((date) => {
            const isUpdating = updatingIds.has(date._id);
            const isEnabled = date.receiveNotifications !== false;

            return (
              <div
                key={date._id}
                className={`notification-item ${
                  isEnabled ? "enabled" : "disabled"
                } ${isUpdating ? "updating" : ""} ${
                  !userReceivesEmails ? "user-disabled" : ""
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
                  </div>
                </div>

                <div className="notification-toggle">
                  <label className="switch">
                    <input
                      type="checkbox"
                      checked={isEnabled}
                      onChange={() => toggleNotifications(date._id, isEnabled)}
                      disabled={isUpdating || !userReceivesEmails}
                    />
                    <span className="slider round"></span>
                  </label>
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
