import React from "react";

// Composant réutilisable pour les toggles de préférence
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

export default PrefToggle;
