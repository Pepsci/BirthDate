import React from "react";
import { useTheme } from "../../context/theme.context";
import "./css/themeToggle.css";

const ThemeToggle = () => {
  const { theme, effectiveTheme, setSpecificTheme } = useTheme();

  const options = [
    { value: "light", icon: "☀️", label: "Clair" },
    { value: "auto", icon: "🔄", label: "Auto" },
    { value: "dark", icon: "🌙", label: "Sombre" },
  ];

  return (
    <div className="theme-toggle-container">
      <h3 className="theme-toggle-title">Thème de l'application</h3>
      <p className="theme-toggle-subtitle">
        {theme === "auto"
          ? `Suit votre système (actuellement ${effectiveTheme === "dark" ? "sombre" : "clair"})`
          : `Mode ${theme === "dark" ? "sombre" : "clair"} activé`}
      </p>

      <div className="theme-toggle-buttons">
        {options.map((option) => (
          <button
            key={option.value}
            onClick={() => setSpecificTheme(option.value)}
            className={`theme-btn ${theme === option.value ? "active" : ""}`}
          >
            <span className="theme-btn-icon">{option.icon}</span>
            <span className="theme-btn-label">{option.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default ThemeToggle;
