import React, { useState } from "react";
import "./css/dateFilter.css";
const DateFilter = ({ onFilterChange }) => {
  const [nameSearch, setNameSearch] = useState("");
  const [surnameSearch, setSurnameSearch] = useState("");
  const [isFamilyFilterActive, setIsFamilyFilterActive] = useState(false);

  const handleFilterChange = (newName, newSurname, familyFilter) => {
    onFilterChange(newName, newSurname, familyFilter);
  };

  const handleNameChange = (event) => {
    const newName = event.target.value;
    setNameSearch(newName);
    handleFilterChange(newName, surnameSearch, isFamilyFilterActive);
  };

  const handleSurnameChange = (event) => {
    const newSurname = event.target.value;
    setSurnameSearch(newSurname);
    handleFilterChange(nameSearch, newSurname, isFamilyFilterActive);
  };

  const toggleFamilyFilter = () => {
    setIsFamilyFilterActive((prev) => {
      const newFilterState = !prev;
      handleFilterChange(nameSearch, surnameSearch, newFilterState);
      return newFilterState;
    });
  };

  const clearFilters = () => {
    setNameSearch("");
    setSurnameSearch("");
    setIsFamilyFilterActive(false);
    handleFilterChange("", "", false);
  };

  return (
    <div className="date-filter">
      <h3 className="title-filter">Filtrer les anniversaires</h3>
      <div className="filter-options">
        <div className="filter-inputs">
          <input
            type="text"
            placeholder=" Prénom..."
            value={nameSearch}
            onChange={handleNameChange}
            className="filter-input"
          />
          <input
            type="text"
            placeholder=" Nom..."
            value={surnameSearch}
            onChange={handleSurnameChange}
            className="filter-input"
          />
        </div>
        <div className="filter-buttons">
          <button
            className={`filter-btn ${isFamilyFilterActive ? "active" : ""}`}
            onClick={toggleFamilyFilter}
          >
            {isFamilyFilterActive
              ? "Afficher toutes les dates"
              : "Famille uniquement"}
          </button>
          <button className="filter-btn" onClick={clearFilters}>
            Effacer les filtres
          </button>
        </div>
      </div>
    </div>
  );
};

export default DateFilter;
