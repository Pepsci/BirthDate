import React, { useState, useEffect } from "react";

const NamedayInput = ({
  value,
  onChange,
  placeholder = "Fête (optionnel)",
}) => {
  const FIXED_YEAR = 2000;

  const [day, setDay] = useState("");
  const [month, setMonth] = useState("");

  // Synchronisation si valeur existante (édition)
  useEffect(() => {
    if (value) {
      const [m, d] = value.split("-");
      setMonth(m);
      setDay(d);
    } else {
      setMonth("");
      setDay("");
    }
  }, [value]);

  const isValidDate = (d, m) => {
    if (!d || !m) return false;
    const testDate = new Date(FIXED_YEAR, m - 1, d);
    return (
      testDate.getFullYear() === FIXED_YEAR &&
      testDate.getMonth() === m - 1 &&
      testDate.getDate() === Number(d)
    );
  };

  const handleChange = (newDay, newMonth) => {
    if (!newDay || !newMonth) {
      onChange("");
      return;
    }

    if (isValidDate(newDay, newMonth)) {
      const mmdd = `${String(newMonth).padStart(2, "0")}-${String(
        newDay,
      ).padStart(2, "0")}`;
      onChange(mmdd);
    } else {
      onChange("");
    }
  };

  const handleDayChange = (e) => {
    const newDay = e.target.value;
    setDay(newDay);
    handleChange(newDay, month);
  };

  const handleMonthChange = (e) => {
    const newMonth = e.target.value;
    setMonth(newMonth);
    handleChange(day, newMonth);
  };

  const handleClear = (e) => {
    e.preventDefault(); // Empêcher la soumission du formulaire
    setDay("");
    setMonth("");
    onChange("");
  };

  const formatNameday = (mmdd) => {
    if (!mmdd) return "";
    const [m, d] = mmdd.split("-");
    const date = new Date(FIXED_YEAR, m - 1, d);
    return date.toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "long",
    });
  };

  return (
    <div className="nameday-input-wrapper">
      <div className="nameday-input-container">
        <select
          value={month}
          onChange={handleMonthChange}
          className="nameday-select"
        >
          <option value="" disabled>
            {placeholder}
          </option>
          <option value="01">Janvier</option>
          <option value="02">Février</option>
          <option value="03">Mars</option>
          <option value="04">Avril</option>
          <option value="05">Mai</option>
          <option value="06">Juin</option>
          <option value="07">Juillet</option>
          <option value="08">Août</option>
          <option value="09">Septembre</option>
          <option value="10">Octobre</option>
          <option value="11">Novembre</option>
          <option value="12">Décembre</option>
        </select>

        <input
          type="number"
          min="1"
          max="31"
          placeholder="Jour"
          value={day}
          onChange={handleDayChange}
          className="nameday-day-select"
        />

        {(day || month) && (
          <button
            type="button"
            onClick={handleClear}
            className="nameday-clear-btn"
            title="Effacer"
          >
            ✕
          </button>
        )}
      </div>

      {value && (
        <div className="nameday-preview">🎂 {formatNameday(value)}</div>
      )}
    </div>
  );
};

export default NamedayInput;
