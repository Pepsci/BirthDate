import React, { useState, useEffect } from "react";
import apiHandler from "../../api/apiHandler";
import useAuth from "../../context/useAuth";
import CreateDate from "./CreateDate";
import Agenda from "./Agenda";
import "./css/dateList.css";
import Countdown from "./Countdown";

const ITEMS_PER_PAGE = 10;
const ITEMS_PER_PAGE_MOBILE = 6;

const DateList = ({ onEditDate, onViewFriendProfile }) => {
  const { currentUser } = useAuth();
  const [dates, setDates] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [isFormVisible, setIsFormVisible] = useState(false);
  const [isFamilyFilterActive, setIsFamilyFilterActive] = useState(false);
  const [itemsPerPage, setItemsPerPage] = useState(
    window.innerWidth <= 600 ? ITEMS_PER_PAGE_MOBILE : ITEMS_PER_PAGE
  );

  // Fonction pour trier les dates
  const sortDates = (datesArray) => {
    const today = new Date();
    return datesArray.sort((a, b) => {
      const nextBirthdayA = new Date(
        today.getFullYear(),
        new Date(a.date).getMonth(),
        new Date(a.date).getDate()
      );
      const nextBirthdayB = new Date(
        today.getFullYear(),
        new Date(b.date).getMonth(),
        new Date(b.date).getDate()
      );

      if (nextBirthdayA < today)
        nextBirthdayA.setFullYear(today.getFullYear() + 1);
      if (nextBirthdayB < today)
        nextBirthdayB.setFullYear(today.getFullYear() + 1);

      return nextBirthdayA - nextBirthdayB;
    });
  };

  useEffect(() => {
    apiHandler
      .get(`/date?owner=${currentUser._id}`)
      .then((dbResponse) => {
        let filteredDates = dbResponse.data;
        if (isFamilyFilterActive) {
          filteredDates = filteredDates.filter((date) => date.family === true);
        }
        setDates(sortDates(filteredDates));
      })
      .catch((e) => console.error(e));
  }, [currentUser, isFamilyFilterActive]);

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
    const updatedDates = sortDates([...dates, newDate]);
    setDates(updatedDates);
  };

  const paginate = (pageNumber) => setCurrentPage(pageNumber);
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = dates.slice(indexOfFirstItem, indexOfLastItem);

  const toggleFamilyFilter = () =>
    setIsFamilyFilterActive(!isFamilyFilterActive);

  const [viewMode, setViewMode] = useState("card");
  const toggleViewMode = () =>
    setViewMode(viewMode === "card" ? "agenda" : "card");

  return (
    <div className="dateList">
      <div className="dateListheaderConter">
        <h1 className="titleFont">Vos BirthDate</h1>
        <button
          className={`btnSwitch ${isFamilyFilterActive ? "active" : ""}`}
          onClick={toggleFamilyFilter}
        >
          {isFamilyFilterActive
            ? "Afficher toutes les dates"
            : "Famille uniquement"}
        </button>
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

      {viewMode === "agenda" ? (
        <Agenda dates={dates} />
      ) : (
        <div className="birthDeck">
          {currentItems.map((date) => (
            <div className="birthCard titleFont" key={date._id + "date"}>
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
                  {new Date().getFullYear() - new Date(date.date).getFullYear()}{" "}
                  Ans
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
                <button onClick={() => onEditDate(date)} className="btn-edit">
                  Edit
                </button>
                <button
                  onClick={() => onViewFriendProfile(date)}
                  className="btn-view"
                >
                  View Profile
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {viewMode === "card" && (
        <div className="pagination">
          <button
            onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
          >
            Précédent
          </button>
          {[...Array(Math.ceil(dates.length / itemsPerPage)).keys()].map(
            (number) => (
              <button key={number + 1} onClick={() => paginate(number + 1)}>
                {number + 1}
              </button>
            )
          )}
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
