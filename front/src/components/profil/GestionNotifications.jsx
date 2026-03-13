import React, { useState, useEffect } from "react";
import apiHandler from "../../api/apiHandler";
import EmailTab from "./notifications/EmailTab";
import FetesTab from "./notifications/FetesTab";
import ChatTab from "./notifications/ChatTab";
import PushTab from "./notifications/Pushtab";
import "./css/notificationTabs.css";
import "./css/gestionNotifications.css";

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
      <div className="notification-header">
        <h2>Gestion des notifications</h2>
      </div>

      <div className="notif-tabs">
        <button
          className={`notif-tab ${activeTab === "emails" ? "active" : ""}`}
          onClick={() => setActiveTab("emails")}
        >
          📧 Anniversaires
        </button>
        <button
          className={`notif-tab ${activeTab === "fetes" ? "active" : ""}`}
          onClick={() => setActiveTab("fetes")}
        >
          🎉 Fêtes
        </button>
        <button
          className={`notif-tab ${activeTab === "chat" ? "active" : ""}`}
          onClick={() => setActiveTab("chat")}
        >
          💬 Messages
        </button>
        <button
          className={`notif-tab ${activeTab === "push" ? "active" : ""}`}
          onClick={() => setActiveTab("push")}
        >
          🔔 Push
        </button>
      </div>

      <div className="notif-tab-content">
        {activeTab === "emails" ? (
          <EmailTab dates={dates} loading={loading} />
        ) : activeTab === "fetes" ? (
          <FetesTab dates={dates} loading={loading} />
        ) : activeTab === "chat" ? (
          <ChatTab />
        ) : (
          <PushTab />
        )}
      </div>
    </div>
  );
};

export default GestionNotification;
