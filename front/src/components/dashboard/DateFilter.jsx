import React, { useState } from "react";

const DateFilter = ({ onFilterChange }) => {
  const [nameSearch, setNameSearch] = useState("");
  const [surnameSearch, setSurnameSearch] = useState("");
  const [isFamilyFilterActive, setIsFamilyFilterActive] = useState(false);
  const [isFilterVisible, setIsFilterVisible] = useState(false);

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

  const toggleFilterVisibility = () => {
    if (isFilterVisible) {
      // Réinitialiser les champs de recherche et le filtre famille
      setNameSearch("");
      setSurnameSearch("");
      setIsFamilyFilterActive(false);
      handleFilterChange("", "", false);
    }
    setIsFilterVisible(!isFilterVisible);
  };

  return (
    <div className="date-filter">
      <button className="btnSwitch" onClick={toggleFilterVisibility}>
        {isFilterVisible ? "Masquer le filtre" : "Filtrer"}
      </button>
      {isFilterVisible && (
        <div className="filter-options">
          <input
            type="text"
            placeholder="Rechercher par prénom..."
            value={nameSearch}
            onChange={handleNameChange}
            className="search-input"
          />
          <input
            type="text"
            placeholder="Rechercher par nom..."
            value={surnameSearch}
            onChange={handleSurnameChange}
            className="search-input"
          />
          <button
            className={`btn ${isFamilyFilterActive ? "active" : ""}`}
            onClick={toggleFamilyFilter}
          >
            {isFamilyFilterActive
              ? "Afficher toutes les dates"
              : "Famille uniquement"}
          </button>
        </div>
      )}
    </div>
  );
};

export default DateFilter;
