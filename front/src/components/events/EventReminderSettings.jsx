import React from "react";

const EventReminderSettings = ({ reminders, onChange }) => {
  const handleToggle = (daysBeforeEvent) => {
    const exists = reminders.some(r => r.daysBeforeEvent === daysBeforeEvent);
    let newReminders = [...reminders];
    
    if (exists) {
      newReminders = newReminders.filter(r => r.daysBeforeEvent !== daysBeforeEvent);
    } else {
      newReminders.push({ type: "event_date", daysBeforeEvent, sent: false });
    }
    
    onChange(newReminders);
  };

  const isChecked = (daysBeforeEvent) => {
    return reminders.some(r => r.daysBeforeEvent === daysBeforeEvent);
  };

  return (
    <div className="reminder-settings" style={{ background: "var(--bg-secondary)", padding: "20px", borderRadius: "15px" }}>
      <h3 style={{ margin: "0 0 10px 0" }}>🔔 Rappels automatiques</h3>
      <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: "15px" }}>
        Configurez quand les invités recevront un email de rappel.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        <label style={{ display: "flex", alignItems: "center", gap: "12px", padding: "12px", borderRadius: "10px", background: "var(--bg-primary)", border: "1px solid var(--border-color)", cursor: "pointer" }}>
          <input 
            type="checkbox" 
            checked={isChecked(7)} 
            onChange={() => handleToggle(7)}
            style={{ width: "18px", height: "18px" }}
          />
          <div>
            <div style={{ fontWeight: "bold" }}>Rappel J-7</div>
            <div style={{ fontSize: "0.8rem", opacity: 0.7 }}>Envoyé une semaine avant l'événement</div>
          </div>
        </label>

        <label style={{ display: "flex", alignItems: "center", gap: "12px", padding: "12px", borderRadius: "10px", background: "var(--bg-primary)", border: "1px solid var(--border-color)", cursor: "pointer" }}>
          <input 
            type="checkbox" 
            checked={isChecked(3)} 
            onChange={() => handleToggle(3)}
            style={{ width: "18px", height: "18px" }}
          />
          <div>
            <div style={{ fontWeight: "bold" }}>Rappel J-3</div>
            <div style={{ fontSize: "0.8rem", opacity: 0.7 }}>Envoyé trois jours avant l'événement</div>
          </div>
        </label>

        <label style={{ display: "flex", alignItems: "center", gap: "12px", padding: "12px", borderRadius: "10px", background: "var(--bg-primary)", border: "1px solid var(--border-color)", cursor: "pointer" }}>
          <input 
            type="checkbox" 
            checked={isChecked(1)} 
            onChange={() => handleToggle(1)}
            style={{ width: "18px", height: "18px" }}
          />
          <div>
            <div style={{ fontWeight: "bold" }}>Rappel J-1 (La veille)</div>
            <div style={{ fontSize: "0.8rem", opacity: 0.7 }}>Le rappel de dernière minute</div>
          </div>
        </label>
      </div>
    </div>
  );
};

export default EventReminderSettings;
