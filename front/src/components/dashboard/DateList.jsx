import React, { useState, useEffect } from "react";
import apiHandler from "../../api/apiHandler";
import useAuth from "../../context/useAuth";
import CreateDate from "./CreateDate";
import Agenda from "./Agenda";
import DateFilter from "./DateFilter";
import Countdown from "./Countdown";
import ManualMergeModal from "./ManuelMergeModal";
import "./css/dateList.css";
import "./css/birthcard.css";

const ITEMS_PER_PAGE = 10;
const ITEMS_PER_PAGE_MOBILE = 6;

const DateList = ({ onEditDate, onViewFriendProfile }) => {
  const { currentUser } = useAuth();
  const [dates, setDates] = useState([]);
  const [allDates, setAllDates] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [isFormVisible, setIsFormVisible] = useState(false);
  const [isFilterVisible, setIsFilterVisible] = useState(false);
  const [itemsPerPage, setItemsPerPage] = useState(
    window.innerWidth <= 600 ? ITEMS_PER_PAGE_MOBILE : ITEMS_PER_PAGE,
  );

  // 👇 AJOUTÉ - État pour le modal de fusion
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [cardToMerge, setCardToMerge] = useState(null);

  const calculateCurrentAge = (birthDate) => {
    const today = new Date();
    const birth = new Date(birthDate);

    let age = today.getFullYear() - birth.getFullYear();

    if (
      today.getMonth() < birth.getMonth() ||
      (today.getMonth() === birth.getMonth() &&
        today.getDate() < birth.getDate())
    ) {
      age--;
    }

    return age;
  };

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

      const isTodayA = dayA === todayDay && monthA === todayMonth;
      const isTodayB = dayB === todayDay && monthB === todayMonth;

      if (isTodayA && !isTodayB) return -1;
      if (!isTodayA && isTodayB) return 1;

      if (isTodayA && isTodayB) {
        return a.name.localeCompare(b.name);
      }

      const nextBirthdayA = new Date(todayYear, monthA, dayA);
      const nextBirthdayB = new Date(todayYear, monthB, dayB);

      if (nextBirthdayA < today) {
        nextBirthdayA.setFullYear(todayYear + 1);
      }

      if (nextBirthdayB < today) {
        nextBirthdayB.setFullYear(todayYear + 1);
      }

      return nextBirthdayA - nextBirthdayB;
    });
  };

  // 👇 AJOUTÉ - Fonction pour recharger les dates après fusion
  const loadDates = () => {
    apiHandler
      .get(`/date?owner=${currentUser._id}`)
      .then((dbResponse) => {
        const sortedDates = sortDates(dbResponse.data);
        setAllDates(sortedDates);
        setDates(sortedDates);
      })
      .catch((e) => console.error(e));
  };

  useEffect(() => {
    loadDates();
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

  const toggleFormVisibility = () => {
    setIsFormVisible(!isFormVisible);
    if (!isFormVisible) {
      setIsFilterVisible(false);
    }
  };

  const toggleFilterVisibility = () => {
    const newVisibility = !isFilterVisible;
    setIsFilterVisible(newVisibility);

    if (!newVisibility) {
      setDates(allDates);
      setCurrentPage(1);
    }

    if (newVisibility) {
      setIsFormVisible(false);
    }
  };

  const handleDateAdded = (newDate) => {
    const updatedDates = sortDates([...allDates, newDate]);
    setAllDates(updatedDates);
    setDates(updatedDates);
    setIsFormVisible(true);
  };

  const handleFilterChange = (newName, newSurname, familyFilter) => {
    let filteredDates = [...allDates];
    if (familyFilter) {
      filteredDates = filteredDates.filter((date) => date.family === true);
    }
    if (newName) {
      filteredDates = filteredDates.filter((date) =>
        date.name.toLowerCase().startsWith(newName.toLowerCase()),
      );
    }
    if (newSurname) {
      filteredDates = filteredDates.filter((date) =>
        date.surname.toLowerCase().startsWith(newSurname.toLowerCase()),
      );
    }
    setDates(filteredDates);
    setCurrentPage(1);
  };

  // 👇 AJOUTÉ - Handler pour ouvrir le modal de fusion
  const handleOpenMergeModal = (date) => {
    setCardToMerge(date);
    setShowMergeModal(true);
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
      <div className="dateListHeader">
        <div className="dateList-tiltle">
          <h1 className="titleFont">Vos BirthDates</h1>
        </div>
        <div className="dateListHeader-btn">
          <button
            className={`btnSwitch ${isFilterVisible ? "active" : ""}`}
            onClick={toggleFilterVisibility}
          >
            Filtre
          </button>

          <button className="btnSwitch" onClick={toggleViewMode}>
            {viewMode === "card" ? "Agenda" : "Carte"}
          </button>

          <button
            className={`btnSwitch ${isFormVisible ? "active" : ""}`}
            onClick={toggleFormVisibility}
          >
            {isFormVisible ? "Cacher le formulaire" : "Ajouter une date"}
          </button>
        </div>

        <div className="forms-container">
          {isFilterVisible && (
            <div className="form-section filter-section">
              <DateFilter onFilterChange={handleFilterChange} />
            </div>
          )}

          {isFormVisible && (
            <div className="form-section add-date-section">
              <CreateDate onDateAdded={handleDateAdded} />
            </div>
          )}
        </div>
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
            const today = new Date();
            const birthDate = new Date(date.date);

            const thisYearBirthday = new Date(
              today.getFullYear(),
              birthDate.getMonth(),
              birthDate.getDate(),
            );

            let nextBirthday = thisYearBirthday;
            if (thisYearBirthday < today) {
              nextBirthday = new Date(
                today.getFullYear() + 1,
                birthDate.getMonth(),
                birthDate.getDate(),
              );
            }

            const diffTime = nextBirthday.getTime() - today.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            const isToday =
              today.getDate() === birthDate.getDate() &&
              today.getMonth() === birthDate.getMonth();

            const isThisWeek = diffDays <= 7 && diffDays > 0;
            const hasGifts = date.gifts && date.gifts.length > 0;
            const isFamily = date.family === true;
            const isFriend = !!date.linkedUser;

            const cardClassName = `
    birthCard titleFont 
    ${isToday ? "today" : ""} 
    ${isThisWeek ? "thisWeek" : ""} 
    ${hasGifts ? "has-gifts" : ""} 
    ${isFamily ? "family" : ""}
    ${isFriend ? "friend-date" : ""}
  `.trim();

            return (
              <div className={cardClassName} key={date._id + "date"}>
                <div className="birthCardName">
                  <span className="birthCard-name">
                    <b>{date.name}</b>
                    {isFriend && <span className="friend-badge">👥 AMI</span>}
                  </span>
                  <span>
                    <b>{date.surname}</b>
                  </span>
                </div>
                <div className="birthCardAge">
                  <span className="age">
                    <span>{calculateCurrentAge(date.date)}</span>{" "}
                    <span>Ans</span>
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
                    {/* 👇 MODIFIÉ - Ajout du bouton Fusionner pour les cartes manuelles */}
                    {!isFriend && (
                      <>
                        <button
                          onClick={() => onEditDate(date)}
                          className="btn-edit"
                        >
                          Modifier
                        </button>
                        <button
                          onClick={() => handleOpenMergeModal(date)}
                          className="btn-merge-manual"
                          title="Fusionner avec une carte ami"
                        >
                          🔄 Fusionner
                        </button>
                      </>
                    )}
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
            key="prev"
            onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
          >
            Précédent
          </button>

          {(() => {
            const totalPages = Math.ceil(dates.length / itemsPerPage);
            const maxPagesToShow = window.innerWidth <= 600 ? 3 : 5;
            const pages = [];

            let startPage, endPage;

            if (totalPages <= maxPagesToShow) {
              startPage = 1;
              endPage = totalPages;
            } else if (currentPage <= Math.ceil(maxPagesToShow / 2)) {
              startPage = 1;
              endPage = maxPagesToShow;
            } else if (
              currentPage + Math.floor(maxPagesToShow / 2) >=
              totalPages
            ) {
              startPage = totalPages - maxPagesToShow + 1;
              endPage = totalPages;
            } else {
              startPage = currentPage - Math.floor(maxPagesToShow / 2);
              endPage = currentPage + Math.floor(maxPagesToShow / 2);
            }

            if (startPage > 1) {
              pages.push(
                <button
                  key="page-1"
                  onClick={() => paginate(1)}
                  className={currentPage === 1 ? "active" : ""}
                  data-page="1"
                >
                  1
                </button>,
              );

              if (startPage > 2) {
                pages.push(
                  <span key="ellipsis-start" className="ellipsis">
                    ...
                  </span>,
                );
              }
            }

            for (let i = startPage; i <= endPage; i++) {
              pages.push(
                <button
                  key={`page-${i}`}
                  onClick={() => paginate(i)}
                  className={currentPage === i ? "active" : ""}
                  data-page={i}
                >
                  {i}
                </button>,
              );
            }

            if (endPage < totalPages) {
              if (endPage < totalPages - 1) {
                pages.push(
                  <span key="ellipsis-end" className="ellipsis">
                    ...
                  </span>,
                );
              }

              pages.push(
                <button
                  key={`page-${totalPages}`}
                  onClick={() => paginate(totalPages)}
                  className={currentPage === totalPages ? "active" : ""}
                  data-page={totalPages}
                >
                  {totalPages}
                </button>,
              );
            }

            return pages;
          })()}

          <button
            key="next"
            onClick={() =>
              setCurrentPage((prev) =>
                Math.min(prev + 1, Math.ceil(dates.length / itemsPerPage)),
              )
            }
            disabled={currentPage === Math.ceil(dates.length / itemsPerPage)}
          >
            Suivant
          </button>
        </div>
      )}

      {/* 👇 AJOUTÉ - Modal de fusion manuelle */}
      {showMergeModal && cardToMerge && (
        <ManualMergeModal
          sourceCard={cardToMerge}
          onClose={() => {
            setShowMergeModal(false);
            setCardToMerge(null);
          }}
          onMergeSuccess={() => {
            loadDates(); // Recharger la liste après fusion
          }}
        />
      )}
    </div>
  );
};

export default DateList;
