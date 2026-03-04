import React, { useState, useEffect } from "react";
import apiHandler from "../../../api/apiHandler";
import PrefToggle from "./PrefToggle";
import "../css/fetesTab.css";

const FetesTab = ({ dates, loading }) => {
  const [updatingDates, setUpdatingDates] = useState(new Set());
  const [isListExpanded, setIsListExpanded] = useState(false);

  const [userEmailPreference, setUserEmailPreference] = useState(true);
  const [loadingUserPref, setLoadingUserPref] = useState(false);

  const [namedayTimings, setNamedayTimings] = useState([1]);
  const [notifyOnNameday, setNotifyOnNameday] = useState(true);
  const [loadingTimings, setLoadingTimings] = useState(false);

  const [filterPrenom, setFilterPrenom] = useState("");
  const [filterNom, setFilterNom] = useState("");

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

      const firstDateWithNameday = dates.find((d) => d.nameday);
      if (
        firstDateWithNameday &&
        firstDateWithNameday.notificationPreferences
      ) {
        setNamedayTimings(
          firstDateWithNameday.notificationPreferences.timings || [1],
        );
        setNotifyOnNameday(
          firstDateWithNameday.notificationPreferences.notifyOnBirthday !==
            false,
        );
      }
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
    const dateIds = localDates.filter((d) => d.nameday).map((d) => d._id);
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

  const handleTimingChange = async (timing) => {
    const newTimings = namedayTimings.includes(timing)
      ? namedayTimings.filter((t) => t !== timing)
      : [...namedayTimings, timing];

    setLoadingTimings(true);
    try {
      const datesWithNameday = localDates.filter((d) => d.nameday);

      await Promise.all(
        datesWithNameday.map((date) =>
          apiHandler.put(`/date/${date._id}/notification-preferences`, {
            timings: newTimings,
            notifyOnBirthday: notifyOnNameday,
          }),
        ),
      );

      setNamedayTimings(newTimings);
      const response = await apiHandler.get("/date");
      setLocalDates(response.data);
    } catch (err) {
      console.error("Erreur mise à jour timing:", err);
    } finally {
      setLoadingTimings(false);
    }
  };

  const handleToggleNotifyOnNameday = async (value) => {
    setLoadingTimings(true);
    try {
      const datesWithNameday = localDates.filter((d) => d.nameday);

      await Promise.all(
        datesWithNameday.map((date) =>
          apiHandler.put(`/date/${date._id}/notification-preferences`, {
            timings: namedayTimings,
            notifyOnBirthday: value,
          }),
        ),
      );

      setNotifyOnNameday(value);
      const response = await apiHandler.get("/date");
      setLocalDates(response.data);
    } catch (err) {
      console.error("Erreur mise à jour notifyOnNameday:", err);
    } finally {
      setLoadingTimings(false);
    }
  };

  const datesWithNameday = localDates.filter((d) => d.nameday);

  const getFilteredDates = () =>
    datesWithNameday.filter((date) => {
      const matchPrenom = filterPrenom
        ? date.name?.toLowerCase().includes(filterPrenom.toLowerCase())
        : true;
      const matchNom = filterNom
        ? date.surname?.toLowerCase().includes(filterNom.toLowerCase())
        : true;
      return matchPrenom && matchNom;
    });

  const filteredDates = getFilteredDates();
  const activeCount = filteredDates.filter(
    (d) => d.receiveNotifications !== false,
  ).length;
  const totalCount = datesWithNameday.length;

  const TIMING_OPTIONS = [
    { value: 7, label: "📅 Une semaine avant", desc: "7 jours avant la fête" },
    { value: 1, label: "📆 La veille", desc: "1 jour avant la fête" },
  ];

  return (
    <div className="tab-content-inner">
      <div className="notification-summary">
        <span className="summary-text">
          {activeCount} sur {totalCount} notifications de fêtes activées
        </span>
      </div>

      <div className="user-email-preferences-simple">
        <PrefToggle
          label="🎉 Recevoir les emails de rappel de fêtes"
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
              ? "⚠️ Les emails sont désactivés. Vous ne recevrez aucune notification de fête par email."
              : null
          }
        />
      </div>

      {userEmailPreference && totalCount > 0 && (
        <div className="frequency-section">
          <h3 className="section-subtitle">
            Quand recevoir les rappels de fêtes ?
          </h3>

          <div className="timing-option-special">
            <label className="timing-checkbox">
              <input
                type="checkbox"
                checked={notifyOnNameday}
                onChange={(e) => handleToggleNotifyOnNameday(e.target.checked)}
                disabled={loadingTimings}
              />
              <span className="timing-label">
                <span className="timing-icon">🎂</span>
                <div className="timing-text">
                  <span className="timing-title">Le jour de la fête</span>
                  <span className="timing-subtitle">Rappel le jour même</span>
                </div>
              </span>
            </label>
          </div>

          <div className="timing-options-grid">
            {TIMING_OPTIONS.map((option) => (
              <label key={option.value} className="timing-checkbox">
                <input
                  type="checkbox"
                  checked={namedayTimings.includes(option.value)}
                  onChange={() => handleTimingChange(option.value)}
                  disabled={loadingTimings}
                />
                <span className="timing-label">
                  <span className="timing-icon">
                    {option.value === 7 ? "📅" : "📆"}
                  </span>
                  <div className="timing-text">
                    <span className="timing-title">
                      {option.label.split(" ").slice(1).join(" ")}
                    </span>
                    <span className="timing-subtitle">{option.desc}</span>
                  </div>
                </span>
              </label>
            ))}
          </div>

          {loadingTimings && (
            <div
              className="loading-indicator"
              style={{ marginTop: "1rem", textAlign: "center" }}
            >
              <div
                className="mini-spinner"
                style={{ display: "inline-block", marginRight: "8px" }}
              ></div>
              <span style={{ fontSize: "14px", opacity: 0.7 }}>
                Mise à jour en cours...
              </span>
            </div>
          )}
        </div>
      )}

      {totalCount === 0 ? (
        <div className="empty-state" style={{ marginTop: "2rem" }}>
          <p>
            Aucune fête définie. Ajoutez des dates de fêtes à vos contacts pour
            recevoir des rappels.
          </p>
        </div>
      ) : (
        <>
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
                <h3>Filtrer les fêtes</h3>
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
                    className="filter-btn"
                    onClick={() => {
                      setFilterPrenom("");
                      setFilterNom("");
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
                    <p>Aucune fête ne correspond aux filtres</p>
                  </div>
                ) : (
                  filteredDates.map((date) => {
                    const isUpdating = updatingDates.has(date._id);
                    const isEnabled = date.receiveNotifications !== false;
                    const isUserDisabled = !userEmailPreference;

                    const [month, day] = (date.nameday || "").split("-");
                    const namedayDate = new Date(
                      2000,
                      parseInt(month) - 1,
                      parseInt(day),
                    );
                    const formattedNameday = namedayDate.toLocaleDateString(
                      "fr-FR",
                      { day: "numeric", month: "long" },
                    );

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
                              🎂 Fête: {formattedNameday}
                            </span>
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
                                    handleToggleNotification(
                                      date._id,
                                      isEnabled,
                                    )
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
        </>
      )}

      <div className="notification-footer">
        <p className="info-text">
          Les préférences de fréquence s'appliquent à toutes les fêtes activées.
        </p>
      </div>
    </div>
  );
};

export default FetesTab;
