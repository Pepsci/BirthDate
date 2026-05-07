import React, { useState, useEffect } from "react";
import apiHandler from "../../../api/apiHandler";
import PrefToggle from "./PrefToggle";

const TIMING_OPTIONS = [
  { value: 0, icon: "🎉", label: "Le jour même", desc: "Rappel le jour J" },
  {
    value: 1,
    icon: "🔔",
    label: "1 jour avant",
    desc: "La veille de l'événement",
  },
  {
    value: 7,
    icon: "🗓️",
    label: "1 semaine avant",
    desc: "7 jours avant l'événement",
  },
];

const EventsTab = () => {
  const [receiveEventEmails, setReceiveEventEmails] = useState(true);
  const [eventEmailTimings, setEventEmailTimings] = useState([1]);
  const [loading, setLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null);

  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    try {
      const response = await apiHandler.get("/users/me");
      const u = response.data;
      setReceiveEventEmails(u.receiveEventEmails !== false);
      if (u.eventEmailTimings !== undefined)
        setEventEmailTimings(u.eventEmailTimings);
    } catch (err) {
      console.error("Erreur chargement préférences événements:", err);
    }
  };

  const toggleTiming = (value) => {
    setEventEmailTimings((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value],
    );
  };

  const handleSave = async () => {
    setLoading(true);
    setSaveStatus(null);
    try {
      await apiHandler.patch("/users/me", {
        receiveEventEmails,
        eventEmailTimings,
      });
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (err) {
      console.error("Erreur sauvegarde préférences événements:", err);
      setSaveStatus("error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="tab-content-inner">
      <div className="user-email-preferences-simple">
        <PrefToggle
          label="📅 Recevoir les emails de rappel d'événements"
          checked={receiveEventEmails}
          onChange={setReceiveEventEmails}
          warning={
            !receiveEventEmails
              ? "⚠️ Les emails sont désactivés. Vous ne recevrez aucun rappel d'événement par email."
              : null
          }
        />
      </div>

      {receiveEventEmails && (
        <div className="frequency-section">
          <h3 className="section-subtitle">Quand recevoir les rappels ?</h3>
          <div className="timing-options-grid">
            {TIMING_OPTIONS.map(({ value, icon, label, desc }) => (
              <label
                key={value}
                className={`timing-checkbox ${eventEmailTimings.includes(value) ? "timing-checkbox--selected" : ""}`}
                onClick={() => toggleTiming(value)}
              >
                <input
                  type="checkbox"
                  checked={eventEmailTimings.includes(value)}
                  onChange={() => toggleTiming(value)}
                  style={{
                    position: "absolute",
                    opacity: 0,
                    width: 0,
                    height: 0,
                  }}
                />
                <span className="timing-label">
                  <span className="timing-icon">{icon}</span>
                  <div className="timing-text">
                    <span className="timing-title">{label}</span>
                    <span className="timing-subtitle">{desc}</span>
                  </div>
                </span>
              </label>
            ))}
          </div>
        </div>
      )}

      <div className="push-save-row" style={{ marginTop: "1rem" }}>
        <button
          className="push-btn push-btn--save"
          onClick={handleSave}
          disabled={loading}
        >
          {loading ? "Sauvegarde..." : "Sauvegarder les préférences"}
        </button>
        {saveStatus === "saved" && (
          <span className="push-save-status success">✓ Sauvegardé</span>
        )}
        {saveStatus === "error" && (
          <span className="push-save-status error">✗ Erreur</span>
        )}
      </div>

      <div className="notification-footer">
        <p className="info-text">
          Ces préférences s'appliquent à tous les événements auxquels vous
          participez ou que vous organisez.
        </p>
      </div>
    </div>
  );
};

export default EventsTab;
