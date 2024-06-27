import React, { useState, useEffect, useRef, require } from "react";
import apiHandler from "../../api/apiHandler";
import useAuth from "../../context/useAuth";
import CreateDate from "./CreateDate";
import "./css/dateList.css";
import corbeille1 from "./icons/corbeille1.png";
import corbeille2 from "./icons/corbeille2.png";
import plus from "./icons/plus.png";
import moins from "./icons/moins.png";
import annule from "./icons/annule.png";
import { getRandomImage } from "./CadeauxRandom";
import Countdown from "./Countdown";
// import UpdateDate from "./UpdateDate";

const ITEMS_PER_PAGE = 10;
const ITEMS_PER_PAGE_MOBILE = 6;

const DateList = () => {
  const [dates, setDates] = useState([]);
  const { currentUser } = useAuth();
  const [currentPage, setCurrentPage] = useState(1);
  const [deleteId, setDeleteId] = useState(null);
  const [isFormVisible, setIsFormVisible] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [dateToUpdate, setDateToUpdate] = useState({
    name: "",
    surname: "",
    date: "",
  });

  useEffect(() => {
    apiHandler
      .get(`/date?owner=${currentUser._id}`)
      .then((dbResponse) => {
        console.log(dbResponse.data);
        setDates(dbResponse.data);
      })
      .catch((e) => {
        console.error(e);
      });
  }, [currentUser]);

  if (!dates) return <p>Loading...</p>;

  const toggleFormVisibility = () => {
    setIsFormVisible(!isFormVisible);
  };

  const handleDateAdded = (newDate) => {
    setDates((prevDates) => [...prevDates, newDate]);
  };

  //delete
  const deleteDate = async (id) => {
    try {
      await apiHandler.delete(`/date/${id}`);
      setDates(dates.filter((date) => date._id !== id));
      setDeleteId(id);
    } catch (error) {
      console.error(error);
    }
  };

  const confirmDelete = (id) => {
    setDeleteId(id);
  };

  const cancelDelete = (e) => {
    e.preventDefault();
    setDeleteId(null);
  };
  //delete

  //age
  const calculateAge = (birthdate) => {
    const birthDate = new Date(birthdate);
    const today = new Date();
    const age = today.getFullYear() - birthDate.getFullYear();
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
  //age

  //pagination
  const paginate = (pageNumber) => setCurrentPage(pageNumber);
  const indexOfLastItem = currentPage * ITEMS_PER_PAGE;
  const indexOfFirstItem = indexOfLastItem - ITEMS_PER_PAGE;
  const currentItems = dates.slice(indexOfFirstItem, indexOfLastItem);

  const nextPage = () => setCurrentPage((prev) => prev + 1);
  const prevPage = () => setCurrentPage((prev) => prev - 1);

  let itemsPerPage =
    window.innerWidth <= 600 ? ITEMS_PER_PAGE_MOBILE : ITEMS_PER_PAGE;
  //pagination

  //edit
  const handleEditDate = async (e) => {
    e.preventDefault();

    const updatedDate = {
      name: dateToUpdate.name,
      surname: dateToUpdate.surname,
      date: dateToUpdate.date,
    };

    try {
      console.log("dateToUpdate", updatedDate);
      const dbResponse = await apiHandler.patch(
        `/date/${dateToUpdate._id}`,
        updatedDate
      );

      // Mettre à jour la liste des dates avec la date mise à jour
      const updatedDates = dates.map((date) => {
        if (date._id === dbResponse.data._id) {
          return dbResponse.data;
        } else {
          return date;
        }
      });

      setDates(updatedDates);
      setEditingId(null);
    } catch (error) {
      console.error(error);
    }
  };

  //edit
  const handleEditMode = (id) => {
    setEditingId(id);
    const date = dates.find((date) => date._id === id);
    setDateToUpdate(date);
  };

  const handleCancelEditDate = (e) => {
    e.preventDefault();
    setEditingId(false);
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    let month = "" + (date.getMonth() + 1);
    let day = "" + date.getDate();
    const year = date.getFullYear();

    if (month.length < 2) month = "0" + month;
    if (day.length < 2) day = "0" + day;

    return [year, month, day].join("-");
  };

  return (
    <div className="dateList">
      <div className="dateListheaderConter">
        <h1 className="titleFont">Vos BirthDate</h1>
        <button
          className={`btnSwitch ${isFormVisible ? "active" : ""}`}
          onClick={toggleFormVisibility}
        >
          {isFormVisible ? "Cacher le formulaire" : "Ajoutez une date"}
        </button>
        {isFormVisible && <CreateDate onDateAdded={handleDateAdded} />}
      </div>

      <div className="birthDeck">
        {currentItems.slice(0, itemsPerPage).map((date) => {
          const randomImage = getRandomImage();
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

              <div className="birthCard-delete birthCardCenter">
                {deleteId !== date._id && (
                  <div>
                    {date._id === editingId ? (
                      //edit
                      <div className="forEditDate">
                        <form className="form-date">
                          {/* <label htmlFor="name">Name</label> */}
                          <input
                            type="text"
                            className="formEditDate"
                            value={dateToUpdate.name}
                            onChange={(e) =>
                              setDateToUpdate({
                                ...dateToUpdate,
                                name: e.target.value,
                              })
                            }
                          />
                          {/* <label htmlFor="surname">Surname</label> */}
                          <input
                            type="text"
                            className="formEditDate"
                            value={dateToUpdate.surname}
                            onChange={(e) =>
                              setDateToUpdate({
                                ...dateToUpdate,
                                surname: e.target.value,
                              })
                            }
                          />
                          {/* <label htmlFor="date">Date</label> */}
                          <input
                            type="date"
                            value={formatDate(dateToUpdate.date)}
                            onChange={(e) =>
                              setDateToUpdate({
                                ...dateToUpdate,
                                date: e.target.value,
                              })
                            }
                          />
                          <button onClick={handleEditDate}>Update</button>
                          <button onClick={handleCancelEditDate}>Cancel</button>
                        </form>
                      </div>
                    ) : (
                      //edit
                      <span className="daysUntilBirthday">
                        <Countdown birthdate={date.date} />
                      </span>
                    )}
                    <br />
                    <img src={randomImage} alt="Random" />
                    <button onClick={() => confirmDelete(date._id)} id="delete">
                      <img src={corbeille2} alt="delete" />
                    </button>
                    <button onClick={() => handleEditMode(date._id)}>
                      Edit
                    </button>
                  </div>
                )}
              </div>

              {deleteId === date._id && (
                <div className="birthCard-deleteMode birthCardDeleteCValidation">
                  <p>are you sur ?</p>
                  <button onClick={cancelDelete} id="delete">
                    <img src={annule} alt="cancel" className="birthCard-icon" />
                  </button>
                  <button onClick={() => deleteDate(date._id)} id="delete">
                    <img
                      src={corbeille1}
                      alt="delete"
                      className="birthCard-icon"
                    />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="pagination">
        <button onClick={prevPage} disabled={currentPage === 1}>
          Précédent
        </button>
        {[...Array(Math.ceil(dates.length / ITEMS_PER_PAGE)).keys()].map(
          (number) => (
            <button key={number + 1} onClick={() => paginate(number + 1)}>
              {number + 1}
            </button>
          )
        )}
        <button
          onClick={nextPage}
          disabled={currentPage === Math.ceil(dates.length / ITEMS_PER_PAGE)}
        >
          Suivant
        </button>
      </div>
    </div>
  );
};

export default DateList;
