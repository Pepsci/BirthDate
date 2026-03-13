import React, { useState } from "react";
import "./css/dateFilter.css";

const DateFilter = ({ onFilterChange, inputRef, friendIds }) => {
  const [nameSearch, setNameSearch] = useState("");
  const [surnameSearch, setSurnameSearch] = useState("");
  const [isFamilyFilterActive, setIsFamilyFilterActive] = useState(false);
  const [isFriendFilterActive, setIsFriendFilterActive] = useState(false);

  const handleFilterChange = (
    newName,
    newSurname,
    familyFilter,
    friendFilter,
  ) => {
    onFilterChange(newName, newSurname, familyFilter, friendFilter);
  };

  const handleNameChange = (event) => {
    const newName = event.target.value;
    setNameSearch(newName);
    onFilterChange(
      newName,
      surnameSearch,
      isFamilyFilterActive,
      isFriendFilterActive,
    );
  };

  const handleSurnameChange = (event) => {
    const newSurname = event.target.value;
    setSurnameSearch(newSurname);
    onFilterChange(
      nameSearch,
      newSurname,
      isFamilyFilterActive,
      isFriendFilterActive,
    );
  };

  const toggleFamilyFilter = () => {
    const newFamily = !isFamilyFilterActive;
    setIsFamilyFilterActive(newFamily);
    // Si on active famille, on désactive amis
    if (newFamily) {
      setIsFriendFilterActive(false);
      onFilterChange(nameSearch, surnameSearch, newFamily, false);
    } else {
      onFilterChange(
        nameSearch,
        surnameSearch,
        newFamily,
        isFriendFilterActive,
      );
    }
  };

  const toggleFriendFilter = () => {
    const newFriend = !isFriendFilterActive;
    setIsFriendFilterActive(newFriend);
    // Si on active amis, on désactive famille
    if (newFriend) {
      setIsFamilyFilterActive(false);
      onFilterChange(nameSearch, surnameSearch, false, newFriend);
    } else {
      onFilterChange(
        nameSearch,
        surnameSearch,
        isFamilyFilterActive,
        newFriend,
      );
    }
  };

  const clearFilters = () => {
    setNameSearch("");
    setSurnameSearch("");
    setIsFamilyFilterActive(false);
    setIsFriendFilterActive(false);
    onFilterChange("", "", false, false);
  };

  return (
    <div className="date-filter">
      <h3 className="title-filter">Filtrer les anniversaires</h3>
      <div className="filter-options">
        <div className="filter-inputs">
          <input
            ref={inputRef}
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
          <button
            className={`filter-btn ${isFriendFilterActive ? "active" : ""}`}
            onClick={toggleFriendFilter}
            disabled={friendIds?.length === 0}
            title={
              friendIds?.length === 0 ? "Vous n'avez pas encore d'amis" : ""
            }
          >
            {isFriendFilterActive
              ? "Afficher toutes les dates"
              : "Amis uniquement"}
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
