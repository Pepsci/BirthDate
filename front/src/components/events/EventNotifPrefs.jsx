import React, { useState, useEffect } from "react";
import apiHandler from "../../api/apiHandler";

const PREFS = [
  {
    key: "rsvp",
    label: "Réponses de présence",
    description: "Quand un invité confirme, décline ou hésite",
    icon: "fa-circle-check",
  },
  {
    key: "dateVote",
    label: "Votes pour la date",
    description: "Quand un invité vote pour une date proposée",
    icon: "fa-calendar-check",
  },
  {
    key: "locationVote",
    label: "Votes pour le lieu",
    description: "Quand un invité vote pour un lieu proposé",
    icon: "fa-location-dot",
  },
  {
    key: "giftProposed",
    label: "Propositions de cadeaux",
    description: "Quand un invité propose une idée cadeau",
    icon: "fa-gift",
  },
  {
    key: "giftVote",
    label: "Votes sur les cadeaux",
    description: "Quand un invité vote pour une idée cadeau",
    icon: "fa-heart",
  },
];

const EventNotifPrefs = ({ shortId, initialPrefs }) => {
  const [prefs, setPrefs] = useState({
    rsvp: true,
    dateVote: true,
    locationVote: true,
    giftProposed: true,
    giftVote: true,
    ...initialPrefs,
  });
  const [saving, setSaving] = useState(null); // key en cours de sauvegarde

  const handleToggle = async (key) => {
    const newValue = !prefs[key];
    setPrefs((prev) => ({ ...prev, [key]: newValue }));
    setSaving(key);

    try {
      await apiHandler.put(`/events/${shortId}/notification-prefs`, {
        [key]: newValue,
      });
    } catch (err) {
      // Rollback si erreur
      setPrefs((prev) => ({ ...prev, [key]: !newValue }));
      console.error("Error updating notification prefs", err);
    } finally {
      setSaving(null);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      <p
        style={{
          margin: "0 0 8px 0",
          fontSize: "0.9rem",
          color: "var(--text-secondary)",
        }}
      >
        Choisissez les actions qui vous envoient une notification.
      </p>

      {PREFS.map((pref) => (
        <div
          key={pref.key}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "14px 16px",
            background: "var(--bg-primary)",
            borderRadius: "12px",
            border: "1px solid var(--border-color)",
            gap: "12px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              flex: 1,
            }}
          >
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "10px",
                background: prefs[pref.key]
                  ? "rgba(59,130,246,0.12)"
                  : "var(--bg-tertiary)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                transition: "background 0.2s",
              }}
            >
              <i
                className={`fa-solid ${pref.icon}`}
                style={{
                  fontSize: "14px",
                  color: prefs[pref.key]
                    ? "var(--primary)"
                    : "var(--text-tertiary)",
                }}
              />
            </div>
            <div>
              <p
                style={{
                  margin: 0,
                  fontWeight: "600",
                  fontSize: "0.9rem",
                  color: "var(--text-primary)",
                }}
              >
                {pref.label}
              </p>
              <p
                style={{
                  margin: 0,
                  fontSize: "0.78rem",
                  color: "var(--text-secondary)",
                }}
              >
                {pref.description}
              </p>
            </div>
          </div>

          {/* Toggle switch */}
          <button
            onClick={() => handleToggle(pref.key)}
            disabled={saving === pref.key}
            style={{
              width: "44px",
              height: "24px",
              borderRadius: "12px",
              border: "none",
              cursor: saving === pref.key ? "wait" : "pointer",
              background: prefs[pref.key]
                ? "var(--primary)"
                : "var(--bg-tertiary)",
              position: "relative",
              flexShrink: 0,
              transition: "background 0.2s",
              padding: 0,
            }}
          >
            <span
              style={{
                position: "absolute",
                top: "3px",
                left: prefs[pref.key] ? "23px" : "3px",
                width: "18px",
                height: "18px",
                borderRadius: "50%",
                background: "#fff",
                transition: "left 0.2s",
                boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
              }}
            />
          </button>
        </div>
      ))}
    </div>
  );
};

export default EventNotifPrefs;
