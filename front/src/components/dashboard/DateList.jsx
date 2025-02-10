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

  useEffect(() => {
    apiHandler
      .get(`/date?owner=${currentUser._id}`)
      .then((dbResponse) => {
        let filteredDates = dbResponse.data;
        if (isFamilyFilterActive) {
          filteredDates = dbResponse.data.filter(
            (date) => date.family === true
          );
        }

        const today = new Date();
        filteredDates.sort((a, b) => {
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

          // Check if the birthday is today and ensure it is displayed first
          const isTodayBirthdayA =
            today.getDate() === nextBirthdayA.getDate() &&
            today.getMonth() === nextBirthdayA.getMonth();

          const isTodayBirthdayB =
            today.getDate() === nextBirthdayB.getDate() &&
            today.getMonth() === nextBirthdayB.getMonth();

          if (isTodayBirthdayA) return -1;
          if (isTodayBirthdayB) return 1;

          if (nextBirthdayA < today) {
            nextBirthdayA.setFullYear(today.getFullYear() + 1);
          }
          if (nextBirthdayB < today) {
            nextBirthdayB.setFullYear(today.getFullYear() + 1);
          }
          return nextBirthdayA - nextBirthdayB;
        });
        setDates(filteredDates);
      })
      .catch((e) => {
        console.error(e);
      });
  }, [currentUser, isFamilyFilterActive]);

  if (!dates) return <p>Loading...</p>;

  const toggleFormVisibility = () => {
    setIsFormVisible(!isFormVisible);
  };

  const handleDateAdded = (newDate) => {
    const updatedDates = [...dates, newDate];
    sortDates(updatedDates);
    setDates(updatedDates);
  };

  const sortDates = (datesArray) => {
    const today = new Date();
    datesArray.sort((a, b) => {
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

      // Check if the birthday is today and ensure it is displayed first
      const isTodayBirthdayA =
        today.getDate() === nextBirthdayA.getDate() &&
        today.getMonth() === nextBirthdayA.getMonth();

      const isTodayBirthdayB =
        today.getDate() === nextBirthdayB.getDate() &&
        today.getMonth() === nextBirthdayB.getMonth();

      if (isTodayBirthdayA) return -1;
      if (isTodayBirthdayB) return 1;

      if (nextBirthdayA < today) {
        nextBirthdayA.setFullYear(today.getFullYear() + 1);
      }
      if (nextBirthdayB < today) {
        nextBirthdayB.setFullYear(today.getFullYear() + 1);
      }
      return nextBirthdayA - nextBirthdayB;
    });
  };

  const calculateAge = (birthdate) => {
    const birthDate = new Date(birthdate);
    const today = new Date();

    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    const dayDiff = today.getDate() - birthDate.getDate();

    if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
      age--;
    }

    return age;
  };

  const calculateDaysUntilBirthday = (birthdate) => {
    const birthDate = new Date(birthdate);
    const today = new Date();
    const nextBirthday = new Date(
      today.getFullYear(),
      birthDate.getMonth(),
      birthDate.getDate()
    );
    if (nextBirthday < today) {
      nextBirthday.setFullYear(today.getFullYear() + 1);
    }
    const daysUntilBirthday = Math.ceil(
      (nextBirthday - today) / (1000 * 60 * 60 * 24)
    );
    return daysUntilBirthday;
  };

  let itemsPerPage =
    window.innerWidth <= 600 ? ITEMS_PER_PAGE_MOBILE : ITEMS_PER_PAGE;

  const paginate = (pageNumber) => setCurrentPage(pageNumber);
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = dates.slice(indexOfFirstItem, indexOfLastItem);
  const nextPage = () => setCurrentPage((prev) => prev + 1);
  const prevPage = () => setCurrentPage((prev) => prev - 1);

  useEffect(() => {
    const handleResize = () => {
      itemsPerPage =
        window.innerWidth <= 600 ? ITEMS_PER_PAGE_MOBILE : ITEMS_PER_PAGE;
      setCurrentPage(1);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const toggleFamilyFilter = () => {
    setIsFamilyFilterActive(!isFamilyFilterActive);
  };

  const [viewMode, setViewMode] = useState("card");
  const toggleViewMode = () => {
    setViewMode(viewMode === "card" ? "agenda" : "card");
  };

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
          {currentItems.map((date) => {
            return (
              <div className="birthCard titleFont" key={date._id + "date"}>
                <div className="birthCardName">
                  <span className="birthCard-name">
                    <b>{date.name}</b>
                  </span>
                  <span>
                    <b>{date.surname}</b>
                  </span>
                  <br />
                </div>
                <div className="birthCardAge">
                  <span className="age">{calculateAge(date.date)} Ans</span>
                  <br />
                </div>
                <div className="birthCardDate">
                  <span className="date">
                    {new Date(date.date).toLocaleDateString("fr-FR")}
                  </span>
                  <br />
                </div>
                <div className="birthCard-actions birthCardCenter">
                  <span className="daysUntilBirthday">
                    <Countdown birthdate={date.date} />
                  </span>
                  <br />
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
            );
          })}
        </div>
      )}

      {viewMode === "card" && (
        <div className="pagination">
          <button onClick={prevPage} disabled={currentPage === 1}>
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
            onClick={nextPage}
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
