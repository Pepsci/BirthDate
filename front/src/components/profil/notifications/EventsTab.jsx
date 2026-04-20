import React, { useState, useEffect } from "react";
import apiHandler from "../../../api/apiHandler";
import PrefToggle from "./PrefToggle";

const TIMING_OPTIONS = [
  { value: 0, icon: "🎉", label: "Le jour même", desc: "Rappel le jour J" },
  {
    value: 1,
    icon: "🔔",
    label: "La veille",
    desc: "1 jour avant l'événement",
  },
  {
    value: 7,
    icon: "🗓️",
    label: "Une semaine avant",
    desc: "7 jours avant l'événement",
  },
];

const EventsTab = () => {
  const [receiveEventEmails, setReceiveEventEmails] = useState(true);
  const [loadingEmailPref, setLoadingEmailPref] = useState(false);

  const [eventTimings, setEventTimings] = useState([1]);
  const [loadingTimings, setLoadingTimings] = useState(false);

  const [saveStatus, setSaveStatus] = useState(null);

  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    try {
      const response = await apiHandler.get("/users/me");
      const u = response.data;
      setReceiveEventEmails(u.receiveEventEmails !== false);
      if (u.pushEventTimings) setEventTimings(u.pushEventTimings);
    } catch (err) {
      console.error("Erreur chargement préférences événements:", err);
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

  const handleTimingChange = (value) => {
    setEventTimings((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value],
    );
  };

  const handleSaveTimings = async () => {
    setLoadingTimings(true);
    setSaveStatus(null);
    try {
      await apiHandler.patch("/users/me", { pushEventTimings: eventTimings });
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (err) {
      console.error("Erreur sauvegarde timings événements:", err);
      setSaveStatus("error");
    } finally {
      setLoadingTimings(false);
    }
  };

  return (
    <div className="tab-content-inner">
      {/* ── Préférences email ── */}
      <div className="user-email-preferences-simple">
        <PrefToggle
          label="📅 Recevoir les emails de rappel d'événements"
          checked={receiveEventEmails}
          loading={loadingEmailPref}
          onChange={(v) =>
            patchUser(
              "receiveEventEmails",
              v,
              setLoadingEmailPref,
              setReceiveEventEmails,
            )
          }
          warning={
            !receiveEventEmails
              ? "⚠️ Les emails sont désactivés. Vous ne recevrez aucun rappel d'événement par email."
              : null
          }
        />
      </div>

      {/* ── Timings ── */}
      <div className="frequency-section">
        <h3 className="section-subtitle">
          Quand recevoir les rappels d'événements ?
        </h3>

        <div className="timing-options-grid">
          {TIMING_OPTIONS.map(({ value, icon, label, desc }) => (
            <label
              key={value}
              className="timing-checkbox"
              onClick={() => handleTimingChange(value)}
            >
              <input
                type="checkbox"
                checked={eventTimings.includes(value)}
                onChange={() => handleTimingChange(value)}
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

        <div className="push-save-row" style={{ marginTop: "1rem" }}>
          <button
            className="push-btn push-btn--save"
            onClick={handleSaveTimings}
            disabled={loadingTimings}
          >
            {loadingTimings ? "Sauvegarde..." : "Sauvegarder les préférences"}
          </button>
          {saveStatus === "saved" && (
            <span className="push-save-status success">✓ Sauvegardé</span>
          )}
          {saveStatus === "error" && (
            <span className="push-save-status error">✗ Erreur</span>
          )}
        </div>
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
