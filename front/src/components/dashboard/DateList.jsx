import React, { useState, useEffect } from "react";
import apiHandler from "../../api/apiHandler";
import useAuth from "../../context/useAuth";
import CreateDate from "./CreateDate";
import Agenda from "./Agenda";
import DateFilter from "./DateFilter";
import Countdown from "./Countdown";
import "./css/birthCard.css";

const ITEMS_PER_PAGE = 10;
const ITEMS_PER_PAGE_MOBILE = 6;

const DateList = ({ onEditDate, onViewFriendProfile }) => {
  const { currentUser } = useAuth();
  const [dates, setDates] = useState([]);
  const [allDates, setAllDates] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [isFormVisible, setIsFormVisible] = useState(false);
  const [itemsPerPage, setItemsPerPage] = useState(
    window.innerWidth <= 600 ? ITEMS_PER_PAGE_MOBILE : ITEMS_PER_PAGE
  );

  // Fonction pour calculer l'âge actuel
  const calculateCurrentAge = (birthDate) => {
    const today = new Date();
    const birth = new Date(birthDate);

    let age = today.getFullYear() - birth.getFullYear();

    // Si l'anniversaire de cette année n'est pas encore passé, on retire 1
    if (
      today.getMonth() < birth.getMonth() ||
      (today.getMonth() === birth.getMonth() &&
        today.getDate() < birth.getDate())
    ) {
      age--;
    }

    return age;
  };

  // Fonction pour trier les dates
  const sortDates = (datesArray) => {
    const today = new Date();
    const todayDay = today.getDate();
    const todayMonth = today.getMonth();
    const todayYear = today.getFullYear();

    return datesArray.sort((a, b) => {
      const dateA = new Date(a.date);
      const dateB = new Date(b.date);

      const dayA = dateA.getDate();
      const monthA = dateA.getMonth();

      const dayB = dateB.getDate();
      const monthB = dateB.getMonth();

      // Vérifier si c'est l'anniversaire aujourd'hui
      const isTodayA = dayA === todayDay && monthA === todayMonth;
      const isTodayB = dayB === todayDay && monthB === todayMonth;

      // Si l'un est aujourd'hui et l'autre non, celui d'aujourd'hui vient en premier
      if (isTodayA && !isTodayB) return -1;
      if (!isTodayA && isTodayB) return 1;

      // Si les deux sont aujourd'hui, trier par nom
      if (isTodayA && isTodayB) {
        return a.name.localeCompare(b.name);
      }

      // Pour les autres dates, calculer la prochaine occurrence
      const nextBirthdayA = new Date(todayYear, monthA, dayA);
      const nextBirthdayB = new Date(todayYear, monthB, dayB);

      // Si la date est déjà passée cette année, on ajoute un an
      if (nextBirthdayA < today) {
        nextBirthdayA.setFullYear(todayYear + 1);
      }

      if (nextBirthdayB < today) {
        nextBirthdayB.setFullYear(todayYear + 1);
      }

      // Trier par date la plus proche
      return nextBirthdayA - nextBirthdayB;
    });
  };

  useEffect(() => {
    apiHandler
      .get(`/date?owner=${currentUser._id}`)
      .then((dbResponse) => {
        const sortedDates = sortDates(dbResponse.data);
        setAllDates(sortedDates);
        setDates(sortedDates);
      })
      .catch((e) => console.error(e));
  }, [currentUser]);

  useEffect(() => {
    const handleResize = () => {
      const newItemsPerPage =
        window.innerWidth <= 600 ? ITEMS_PER_PAGE_MOBILE : ITEMS_PER_PAGE;
      if (itemsPerPage !== newItemsPerPage) {
        setItemsPerPage(newItemsPerPage);
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [itemsPerPage]);

  const toggleFormVisibility = () => setIsFormVisible(!isFormVisible);

  const handleDateAdded = (newDate) => {
    const updatedDates = sortDates([...allDates, newDate]);
    setAllDates(updatedDates);
    setDates(updatedDates);
  };

  const handleFilterChange = (newName, newSurname, familyFilter) => {
    let filteredDates = [...allDates];
    if (familyFilter) {
      filteredDates = filteredDates.filter((date) => date.family === true);
    }
    if (newName) {
      filteredDates = filteredDates.filter((date) =>
        date.name.toLowerCase().startsWith(newName.toLowerCase())
      );
    }
    if (newSurname) {
      filteredDates = filteredDates.filter((date) =>
        date.surname.toLowerCase().startsWith(newSurname.toLowerCase())
      );
    }
    setDates(filteredDates);
    // Réinitialiser à la première page quand le filtre change
    setCurrentPage(1);
  };

  const paginate = (pageNumber) => setCurrentPage(pageNumber);
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = dates.slice(indexOfFirstItem, indexOfLastItem);

  const [viewMode, setViewMode] = useState("card");
  const toggleViewMode = () =>
    setViewMode(viewMode === "card" ? "agenda" : "card");

  return (
    <div className="dateList">
      <div className="dateListheaderConter">
        <h1 className="titleFont">Vos BirthDate</h1>
        <DateFilter onFilterChange={handleFilterChange} />
        <button className="btnSwitch" onClick={toggleViewMode}>
          {viewMode === "card"
            ? "Passer en mode agenda"
            : "Passer en mode carte"}
        </button>
        <button
          className={`btnSwitch ${isFormVisible ? "active" : ""}`}
          onClick={toggleFormVisibility}
        >
          {isFormVisible ? "Cacher le formulaire" : "Ajoutez une date"}
        </button>
        {isFormVisible && <CreateDate onDateAdded={handleDateAdded} />}
      </div>

      {dates.length === 0 ? (
        <div className="no-results">
          Aucun résultat trouvé pour cette recherche
        </div>
      ) : viewMode === "agenda" ? (
        <Agenda dates={dates} />
      ) : (
        <div className="birthDeck">
          {currentItems.map((date) => {
            // Calculer si c'est un anniversaire aujourd'hui ou cette semaine
            const today = new Date();
            const birthDate = new Date(date.date);
            const nextBirthday = new Date(
              today.getFullYear(),
              birthDate.getMonth(),
              birthDate.getDate()
            );

            if (nextBirthday < today) {
              nextBirthday.setFullYear(today.getFullYear() + 1);
            }

            const diffTime = Math.abs(nextBirthday - today);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            const isToday = diffDays === 0;
            const isThisWeek = diffDays <= 7 && !isToday;
            const hasGifts = date.gifts && date.gifts.length > 0;
            const isFamily = date.family === true;

            // Ajouter une classe CSS conditionnelle pour la famille, sans le badge
            const cardClassName = `
              birthCard titleFont 
              ${isToday ? "today" : ""} 
              ${isThisWeek ? "thisWeek" : ""} 
              ${hasGifts ? "has-gifts" : ""} 
              ${isFamily ? "family" : ""}
            `;

            return (
              <div className={cardClassName} key={date._id + "date"}>
                <div className="birthCardName">
                  <span className="birthCard-name">
                    <b>{date.name}</b>
                  </span>
                  <span>
                    <b>{date.surname}</b>
                  </span>
                </div>
                <div className="birthCardAge">
                  <span className="age">
                    {calculateCurrentAge(date.date)} Ans
                  </span>
                </div>
                <div className="birthCardDate">
                  <span className="date">
                    {new Date(date.date).toLocaleDateString("fr-FR")}
                  </span>
                </div>
                <div className="birthCard-actions birthCardCenter">
                  <span className="daysUntilBirthday">
                    <Countdown birthdate={date.date} />
                  </span>
                  <div className="button-group">
                    <button
                      onClick={() => onEditDate(date)}
                      className="btn-edit"
                    >
                      Modifier
                    </button>
                    <button
                      onClick={() => onViewFriendProfile(date)}
                      className="btn-view"
                    >
                      Voir Profil
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {viewMode === "card" && dates.length > 0 && (
        <div className="pagination">
          <button
            onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
          >
            Précédent
          </button>

          {(() => {
            const totalPages = Math.ceil(dates.length / itemsPerPage);
            const maxPagesToShow = window.innerWidth <= 600 ? 3 : 5;
            const pages = [];

            // Toujours afficher la première page
            if (currentPage > 2) {
              pages.push(
                <button key={1} onClick={() => paginate(1)}>
                  1
                </button>
              );

              // Ajouter des points de suspension si nécessaire
              if (currentPage > 3) {
                pages.push(
                  <span key="ellipsis1" className="ellipsis">
                    ...
                  </span>
                );
              }
            }

            // Afficher les pages autour de la page actuelle
            const startPage = Math.max(
              1,
              currentPage - Math.floor(maxPagesToShow / 2)
            );
            const endPage = Math.min(
              totalPages,
              startPage + maxPagesToShow - 1
            );

            for (let i = startPage; i <= endPage; i++) {
              pages.push(
                <button
                  key={i}
                  onClick={() => paginate(i)}
                  className={`pagination-number-button ${
                    currentPage === i ? "active" : ""
                  }`}
                >
                  {i}
                </button>
              );
            }

            // Ajouter des points de suspension pour les pages suivantes si nécessaire
            if (endPage < totalPages - 1) {
              pages.push(
                <span key="ellipsis2" className="ellipsis">
                  ...
                </span>
              );
            }

            // Toujours afficher la dernière page
            if (endPage < totalPages) {
              pages.push(
                <button key={totalPages} onClick={() => paginate(totalPages)}>
                  {totalPages}
                </button>
              );
            }

            return pages;
          })()}

          <button
            onClick={() =>
              setCurrentPage((prev) =>
                Math.min(prev + 1, Math.ceil(dates.length / itemsPerPage))
              )
            }
            disabled={currentPage === Math.ceil(dates.length / itemsPerPage)}
          >
            Suivant
          </button>
        </div>
      )}
    </div>
  );
};

export default DateList;
