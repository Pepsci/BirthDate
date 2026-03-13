import React, { useState, useEffect } from "react";
import apiHandler from "../../../api/apiHandler";
import PrefToggle from "./PrefToggle";

const EmailTab = ({ dates, loading }) => {
  const [updatingDates, setUpdatingDates] = useState(new Set());
  const [isListExpanded, setIsListExpanded] = useState(false);

  const [userEmailPreference, setUserEmailPreference] = useState(true);
  const [loadingUserPref, setLoadingUserPref] = useState(false);
  const [receiveFriendRequestEmails, setReceiveFriendRequestEmails] =
    useState(true);
  const [loadingFriendPref, setLoadingFriendPref] = useState(false);
  const [receiveOwnBirthdayEmail, setReceiveOwnBirthdayEmail] = useState(true);
  const [loadingOwnBirthdayPref, setLoadingOwnBirthdayPref] = useState(false);

  const [filterPrenom, setFilterPrenom] = useState("");
  const [filterNom, setFilterNom] = useState("");
  const [filterFamille, setFilterFamille] = useState(false);

  const [localDates, setLocalDates] = useState(dates);

  useEffect(() => {
    setLocalDates(dates);
  }, [dates]);
  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    try {
      const response = await apiHandler.get("/users/me");
      setUserEmailPreference(response.data.receiveBirthdayEmails !== false);
      setReceiveFriendRequestEmails(
        response.data.receiveFriendRequestEmails !== false,
      );
      setReceiveOwnBirthdayEmail(
        response.data.receiveOwnBirthdayEmail !== false,
      );
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
      setLocalDates((prev) =>
        prev.map((d) => (d._id === dateId ? updatedDate : d)),
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

  const handleBulk = async (enable) => {
    const dateIds = localDates.map((d) => d._id);
    setUpdatingDates(new Set(dateIds));
    try {
      await apiHandler.bulkUpdateNotifications(dateIds, enable);
      const response = await apiHandler.get("/date");
      setLocalDates(response.data);
    } catch (err) {
      console.error("Erreur bulk:", err);
    } finally {
      setUpdatingDates(new Set());
    }
  };

  const patchUser = async (field, value, setLoading, setState) => {
    setLoading(true);
    try {
      await apiHandler.patch("/users/me", { [field]: value });
      setState(value);
    } catch (err) {
      console.error("Erreur mise à jour préférence:", err);
    } finally {
      setLoading(false);
    }
  };

  const getFilteredDates = () =>
    localDates.filter((date) => {
      const matchPrenom = filterPrenom
        ? date.name?.toLowerCase().includes(filterPrenom.toLowerCase())
        : true;
      const matchNom = filterNom
        ? date.surname?.toLowerCase().includes(filterNom.toLowerCase())
        : true;
      const matchFamille = filterFamille ? date.famille === true : true;
      return matchPrenom && matchNom && matchFamille;
    });

  const filteredDates = getFilteredDates();
  const activeCount = filteredDates.filter(
    (d) => d.receiveNotifications !== false,
  ).length;
  const totalCount = localDates.length;

  return (
    <div className="tab-content-inner">
      <div className="notification-summary">
        <span className="summary-text">
          {activeCount} sur {totalCount} notifications emails activées
        </span>
      </div>

      <div className="user-email-preferences-simple">
        <PrefToggle
          label="🎂 Recevoir les emails de rappel d'anniversaires"
          checked={userEmailPreference}
          loading={loadingUserPref}
          onChange={(v) =>
            patchUser(
              "receiveBirthdayEmails",
              v,
              setLoadingUserPref,
              setUserEmailPreference,
            )
          }
          warning={
            !userEmailPreference
              ? "⚠️ Les emails sont désactivés. Vous ne recevrez aucune notification par email."
              : null
          }
        />
        <PrefToggle
          label="👥 Recevoir les emails de demandes d'amis"
          checked={receiveFriendRequestEmails}
          loading={loadingFriendPref}
          onChange={(v) =>
            patchUser(
              "receiveFriendRequestEmails",
              v,
              setLoadingFriendPref,
              setReceiveFriendRequestEmails,
            )
          }
          warning={
            !receiveFriendRequestEmails
              ? "⚠️ Vous ne recevrez pas d'email quand quelqu'un vous envoie une demande d'ami."
              : null
          }
        />
        <PrefToggle
          label="🎉 Recevoir un email le jour de mon anniversaire"
          checked={receiveOwnBirthdayEmail}
          loading={loadingOwnBirthdayPref}
          onChange={(v) =>
            patchUser(
              "receiveOwnBirthdayEmail",
              v,
              setLoadingOwnBirthdayPref,
              setReceiveOwnBirthdayEmail,
            )
          }
          warning={
            !receiveOwnBirthdayEmail
              ? "⚠️ Vous ne recevrez pas d'email le jour de votre anniversaire."
              : null
          }
        />
      </div>

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

      {isListExpanded && (
        <div className="collapsible-content">
          <div className="filter-section">
            <h3>Filtrer les anniversaires</h3>
            <div className="filter-inputs">
              <input
                type="text"
                placeholder="Prénom..."
                className="filter-input"
                value={filterPrenom}
                onChange={(e) => setFilterPrenom(e.target.value)}
              />
              <input
                type="text"
                placeholder="Nom..."
                className="filter-input"
                value={filterNom}
                onChange={(e) => setFilterNom(e.target.value)}
              />
            </div>
            <div className="filter-buttons">
              <button
                className={`filter-btn ${filterFamille ? "active" : ""}`}
                onClick={() => setFilterFamille(!filterFamille)}
              >
                {filterFamille ? "✓ " : ""}Famille uniquement
              </button>
              <button
                className="filter-btn"
                onClick={() => {
                  setFilterPrenom("");
                  setFilterNom("");
                  setFilterFamille(false);
                }}
              >
                Effacer les filtres
              </button>
            </div>
          </div>

          <div className="global-actions">
            <button
              className="action-button enable-all"
              onClick={() => handleBulk(true)}
              disabled={updatingDates.size > 0}
            >
              ✓ Activer tout
            </button>
            <button
              className="action-button disable-all"
              onClick={() => handleBulk(false)}
              disabled={updatingDates.size > 0}
            >
              ✕ Désactiver tout
            </button>
          </div>

          <div className="notification-list">
            {filteredDates.length === 0 ? (
              <div className="empty-state">
                <p>
                  {localDates.length === 0
                    ? "Aucun anniversaire à afficher"
                    : "Aucun anniversaire ne correspond aux filtres"}
                </p>
              </div>
            ) : (
              filteredDates.map((date) => {
                const isUpdating = updatingDates.has(date._id);
                const isEnabled = date.receiveNotifications !== false;
                const isUserDisabled = !userEmailPreference;

                return (
                  <div
                    key={date._id}
                    className={`notification-item ${isEnabled ? "enabled" : "disabled"} ${isUpdating ? "updating" : ""} ${isUserDisabled ? "user-disabled" : ""}`}
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
                            className={`status-text ${isEnabled ? "enabled" : "disabled"}`}
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

      <div className="notification-footer">
        <p className="info-text">
          Les notifications actives recevront des rappels par email.
        </p>
      </div>
    </div>
  );
};

export default EmailTab;
