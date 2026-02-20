import React, { useState, useEffect } from "react";
import apiHandler from "../../api/apiHandler";
import "./css/gestionNotifications.css";

// ─────────────────────────────────────────────
// Onglet 1 : Préférences emails (existant)
// ─────────────────────────────────────────────
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
      {/* Résumé */}
      <div className="notification-summary">
        <span className="summary-text">
          {activeCount} sur {totalCount} notifications activées
        </span>
      </div>

      {/* Préférences globales */}
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

      {/* Toggle liste */}
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

      {/* Liste collapsible */}
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

// ─────────────────────────────────────────────
// Onglet 2 : Notifications emails chat (nouveau)
// ─────────────────────────────────────────────
const ChatTab = () => {
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(true);

  // Préférences globales chat
  const [receiveChatEmails, setReceiveChatEmails] = useState(true);
  const [loadingGlobal, setLoadingGlobal] = useState(false);
  const [chatEmailFrequency, setChatEmailFrequency] = useState("daily");
  const [loadingFreq, setLoadingFreq] = useState(false);

  // Préférences par ami : { [friendId]: boolean }
  const [friendPrefs, setFriendPrefs] = useState({});
  const [updatingFriends, setUpdatingFriends] = useState(new Set());

  // Liste déroulante + filtre
  const [isListExpanded, setIsListExpanded] = useState(false);
  const [filterName, setFilterName] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [userRes, friendsRes] = await Promise.all([
        apiHandler.get("/users/me"),
        apiHandler.get("/friends"),
      ]);

      setReceiveChatEmails(userRes.data.receiveChatEmails !== false);
      setChatEmailFrequency(userRes.data.chatEmailFrequency || "daily");

      // Construire les prefs par ami
      // Structure réelle de /friends : [{ friendUser: { _id, name, surname }, friendship: {...} }]
      const prefs = {};
      const rawList = friendsRes.data || [];
      const disabled = userRes.data.chatEmailDisabledFriends || [];

      rawList.forEach((f) => {
        const friendId = f.friendUser?._id?.toString();
        if (friendId) {
          prefs[friendId] = !disabled.map(String).includes(friendId);
        }
      });
      setFriendPrefs(prefs);
      setFriends(rawList);
    } catch (err) {
      console.error("Erreur chargement préférences chat:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleGlobal = async (value) => {
    setLoadingGlobal(true);
    try {
      await apiHandler.patch("/users/me", { receiveChatEmails: value });
      setReceiveChatEmails(value);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingGlobal(false);
    }
  };

  const handleFrequencyChange = async (value) => {
    setLoadingFreq(true);
    try {
      await apiHandler.patch("/users/me", { chatEmailFrequency: value });
      setChatEmailFrequency(value);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingFreq(false);
    }
  };

  const handleToggleFriend = async (friendId, currentValue) => {
    setUpdatingFriends((prev) => new Set(prev).add(friendId));
    try {
      await apiHandler.patch("/users/me/chat-email-prefs", {
        friendId,
        enabled: !currentValue,
      });
      setFriendPrefs((prev) => ({ ...prev, [friendId]: !currentValue }));
    } catch (err) {
      console.error(err);
    } finally {
      setUpdatingFriends((prev) => {
        const s = new Set(prev);
        s.delete(friendId);
        return s;
      });
    }
  };

  const FREQUENCY_OPTIONS = [
    {
      value: "instant",
      label: "⚡ Instantané",
      desc: "Dès qu'un message arrive",
    },
    {
      value: "twice_daily",
      label: "🕑 Deux fois par jour",
      desc: "À 9h et à 18h",
    },
    {
      value: "daily",
      label: "📅 Résumé quotidien",
      desc: "Une fois par jour à 9h",
    },
    {
      value: "weekly",
      label: "📆 Résumé hebdomadaire",
      desc: "Chaque lundi matin",
    },
  ];

  if (loading) {
    return (
      <div className="tab-content-inner">
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>Chargement...</p>
        </div>
      </div>
    );
  }

  // Calcul du résumé global (ici pour l'afficher avant le toggle)
  const activeChatCount = friends.filter((f) => {
    const friendUser = f.friendUser || f;
    const friendId = (friendUser?._id || "").toString();
    return friendPrefs[friendId] !== false;
  }).length;

  return (
    <div className="tab-content-inner">
      {/* Résumé global */}
      {friends.length > 0 && (
        <div className="notification-summary" style={{ marginBottom: "1rem" }}>
          <span className="summary-text">
            {activeChatCount} sur {friends.length} notifications activées
          </span>
        </div>
      )}

      {/* Toggle global */}
      <div className="user-email-preferences-simple">
        <PrefToggle
          label="💬 Recevoir des emails pour les messages non lus"
          checked={receiveChatEmails}
          loading={loadingGlobal}
          onChange={handleToggleGlobal}
          warning={
            !receiveChatEmails
              ? "⚠️ Vous ne recevrez aucun email de notification de message."
              : null
          }
        />
      </div>

      {/* Fréquence */}
      {receiveChatEmails && (
        <div className="frequency-section">
          <h3 className="section-subtitle">Fréquence d'envoi</h3>
          <div className="frequency-options">
            {FREQUENCY_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                className={`frequency-btn ${chatEmailFrequency === opt.value ? "active" : ""}`}
                onClick={() => handleFrequencyChange(opt.value)}
                disabled={loadingFreq}
              >
                <span className="freq-label">{opt.label}</span>
                <span className="freq-desc">{opt.desc}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Résumé + liste déroulante par ami */}
      {receiveChatEmails &&
        friends.length > 0 &&
        (() => {
          const activeCount = friends.filter((f) => {
            const friendUser = f.friendUser || f;
            const friendId = (friendUser?._id || "").toString();
            return friendPrefs[friendId] !== false;
          }).length;

          const filteredFriends = friends.filter((f) => {
            const friendUser = f.friendUser || f;
            const fullName =
              `${friendUser?.name || ""} ${friendUser?.surname || ""}`.toLowerCase();
            return fullName.includes(filterName.toLowerCase());
          });

          return (
            <div className="friends-chat-prefs">
              {/* Toggle liste */}
              <div className="list-toggle-section">
                <button
                  className="toggle-list-btn"
                  onClick={() => setIsListExpanded(!isListExpanded)}
                >
                  <span className="toggle-icon">
                    {isListExpanded ? "▼" : "▶"}
                  </span>
                  <span className="toggle-text">
                    {isListExpanded ? "Masquer la liste" : "Afficher la liste"}
                  </span>
                  <span className="toggle-count">({friends.length})</span>
                </button>
              </div>

              {/* Liste collapsible avec filtre */}
              {isListExpanded && (
                <div className="collapsible-content">
                  <div className="filter-section">
                    <h3>Filtrer les amis</h3>
                    <div className="filter-inputs">
                      <input
                        type="text"
                        placeholder="Prénom ou nom..."
                        className="filter-input"
                        value={filterName}
                        onChange={(e) => setFilterName(e.target.value)}
                        style={{ width: "100%" }}
                      />
                    </div>
                    {filterName && (
                      <div className="filter-buttons">
                        <button
                          className="filter-btn"
                          onClick={() => setFilterName("")}
                        >
                          Effacer le filtre
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="notification-list">
                    {filteredFriends.length === 0 ? (
                      <div className="empty-state">
                        <p>Aucun ami ne correspond au filtre.</p>
                      </div>
                    ) : (
                      filteredFriends.map((f, index) => {
                        const friendUser = f.friendUser || f;
                        const friendId = (
                          friendUser?._id ||
                          f.friendship?._id ||
                          index
                        ).toString();
                        const friendName = friendUser?.name || "Ami";
                        const friendSurname = friendUser?.surname || "";
                        const isEnabled = friendPrefs[friendId] !== false;
                        const isUpdating = updatingFriends.has(friendId);

                        return (
                          <div
                            key={friendId}
                            className={`notification-item ${isEnabled ? "enabled" : "disabled"}`}
                          >
                            <div className="person-info">
                              <div className="person-name">
                                <span className="name">{friendName}</span>
                                <span className="surname">{friendSurname}</span>
                              </div>
                              <div className="person-details">
                                <span className="birth-date chat-hint">
                                  {isEnabled
                                    ? "Emails activés pour ce contact"
                                    : "Emails désactivés pour ce contact"}
                                </span>
                              </div>
                            </div>
                            <div className="notification-toggle">
                              {isUpdating ? (
                                <div className="updating-text">
                                  <div className="mini-spinner"></div>
                                </div>
                              ) : (
                                <>
                                  <label className="switch">
                                    <input
                                      type="checkbox"
                                      checked={isEnabled}
                                      onChange={() =>
                                        handleToggleFriend(friendId, isEnabled)
                                      }
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
            </div>
          );
        })()}

      <div className="notification-footer">
        <p className="info-text">
          Les emails de chat sont envoyés uniquement pour les messages non lus.
        </p>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────
// Composant réutilisable PrefToggle
// ─────────────────────────────────────────────
const PrefToggle = ({ label, checked, loading, onChange, warning }) => (
  <div className="pref-toggle-wrapper">
    <div className="user-pref-toggle-simple">
      <div className="toggle-info">
        <span className="toggle-label">{label}</span>
      </div>
      <label className="switch">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          disabled={loading}
        />
        <span className="slider round"></span>
      </label>
    </div>
    {warning && <div className="warning-simple">{warning}</div>}
  </div>
);

// ─────────────────────────────────────────────
// Composant principal
// ─────────────────────────────────────────────
const GestionNotification = () => {
  const [activeTab, setActiveTab] = useState("emails");
  const [dates, setDates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadDates();
  }, []);

  const loadDates = async () => {
    try {
      setLoading(true);
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
      </div>

      {/* Onglets */}
      <div className="notif-tabs">
        <button
          className={`notif-tab ${activeTab === "emails" ? "active" : ""}`}
          onClick={() => setActiveTab("emails")}
        >
          📧 Emails
        </button>
        <button
          className={`notif-tab ${activeTab === "chat" ? "active" : ""}`}
          onClick={() => setActiveTab("chat")}
        >
          💬 Messages Chat
        </button>
      </div>

      {/* Contenu des onglets */}
      <div className="notif-tab-content">
        {activeTab === "emails" ? (
          <EmailTab dates={dates} loading={loading} />
        ) : (
          <ChatTab />
        )}
      </div>
    </div>
  );
};

export default GestionNotification;
