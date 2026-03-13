import React, { useState, useEffect } from "react";
import apiHandler from "../../../api/apiHandler";
import PrefToggle from "./PrefToggle";

const ChatTab = () => {
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(true);
  const [receiveChatEmails, setReceiveChatEmails] = useState(true);
  const [loadingGlobal, setLoadingGlobal] = useState(false);
  const [chatEmailFrequency, setChatEmailFrequency] = useState("daily");
  const [loadingFreq, setLoadingFreq] = useState(false);
  const [friendPrefs, setFriendPrefs] = useState({});
  const [updatingFriends, setUpdatingFriends] = useState(new Set());
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

      const prefs = {};
      const rawList = friendsRes.data || [];
      const disabled = userRes.data.chatEmailDisabledFriends || [];
      rawList.forEach((f) => {
        const friendId = f.friendUser?._id?.toString();
        if (friendId)
          prefs[friendId] = !disabled.map(String).includes(friendId);
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
      icon: "⚡",
      label: "Instantané",
      desc: "Dès qu'un message arrive",
    },
    {
      value: "twice_daily",
      icon: "🕑",
      label: "Deux fois par jour",
      desc: "À 9h et à 18h",
    },
    {
      value: "daily",
      icon: "📅",
      label: "Résumé quotidien",
      desc: "Une fois par jour à 9h",
    },
    {
      value: "weekly",
      icon: "📆",
      label: "Résumé hebdomadaire",
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

  const activeChatCount = friends.filter((f) => {
    const friendUser = f.friendUser || f;
    const friendId = (friendUser?._id || "").toString();
    return friendPrefs[friendId] !== false;
  }).length;

  return (
    <div className="tab-content-inner">
      {friends.length > 0 && (
        <div className="notification-summary">
          <span className="summary-text">
            {activeChatCount} sur {friends.length} notifications activées
          </span>
        </div>
      )}

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

      {receiveChatEmails && (
        <div className="frequency-section">
          <h3 className="section-subtitle">Fréquence d'envoi</h3>
          <div
            className="timing-options-grid"
            style={{ gridTemplateColumns: "1fr" }}
          >
            {FREQUENCY_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className="timing-checkbox"
                onClick={() => handleFrequencyChange(opt.value)}
                style={{ cursor: "pointer" }}
              >
                <input
                  type="radio"
                  checked={chatEmailFrequency === opt.value}
                  onChange={() => handleFrequencyChange(opt.value)}
                  disabled={loadingFreq}
                  style={{
                    position: "absolute",
                    opacity: 0,
                    width: 0,
                    height: 0,
                  }}
                />
                <span className="timing-label">
                  <span className="timing-icon">{opt.icon}</span>
                  <div className="timing-text">
                    <span className="timing-title">{opt.label}</span>
                    <span className="timing-subtitle">{opt.desc}</span>
                  </div>
                </span>
              </label>
            ))}
          </div>
        </div>
      )}

      {receiveChatEmails &&
        friends.length > 0 &&
        (() => {
          const filteredFriends = friends.filter((f) => {
            const friendUser = f.friendUser || f;
            const fullName =
              `${friendUser?.name || ""} ${friendUser?.surname || ""}`.toLowerCase();
            return fullName.includes(filterName.toLowerCase());
          });

          return (
            <div className="friends-chat-prefs">
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
                        const isEnabled = friendPrefs[friendId] !== false;
                        const isUpdating = updatingFriends.has(friendId);

                        return (
                          <div
                            key={friendId}
                            className={`notification-item ${isEnabled ? "enabled" : "disabled"}`}
                          >
                            <div className="person-info">
                              <div className="person-name">
                                <span className="name">
                                  {friendUser?.name || "Ami"}
                                </span>
                                <span className="surname">
                                  {friendUser?.surname || ""}
                                </span>
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

export default ChatTab;
