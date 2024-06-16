import React, { useState, useEffect, useRef } from "react";
import apiHandler from "../../api/apiHandler";
import useAuth from "../../context/useAuth";
import CreateDate from "./CreateDate";
import "./css/dateList.css";
import corbeille1 from "./icons/corbeille1.png";
import corbeille2 from "./icons/corbeille2.png";
import annule from "./icons/annule.png";

const DateList = () => {
  const [dates, setDates] = useState([]);
  const [searchDate] = useState("");
  const { currentUser } = useAuth();

  const [deleteId, setDeleteId] = useState(null);

  useEffect(() => {
    apiHandler
      .get(`/date?owner=${currentUser._id}`)
      .then((dbResponse) => {
        setDates(dbResponse.data);
        console.log("reponse db", dbResponse.data);
      })
      .catch((e) => {
        console.error(e);
      });
  }, [currentUser]);

  if (!dates) return <p>Loading...</p>;

  let search = null;
  if (searchDate !== "") {
    search = dates.filter((date) => {
      return date.name.toLowerCase().includes(searchDate.toLowerCase());
    });
  } else {
    search = dates;
  }

  const handleDateAdded = (newDate) => {
    setDates((prevDates) => [...prevDates, newDate]);
  };

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

  const cancelDelet = (e) => {
    e.preventDefault();
    setDeleteId(null);
  };

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

  const Countdown = ({ daysUntilBirthday }) => {
    const [countdown, setCountdown] = useState(
      daysUntilBirthday * 24 * 60 * 60
    );

    useEffect(() => {
      const timer = setInterval(() => {
        setCountdown((prevCountdown) => prevCountdown - 1);
      }, 1000);

      return () => clearInterval(timer);
    }, []);

    const days = Math.floor(countdown / (24 * 3600));
    const hours = Math.floor((countdown % (24 * 3600)) / 3600);
    const minutes = Math.floor((countdown % 3600) / 60);
    const seconds = countdown % 60;

    return (
      <div>
        {days} jours {hours} heures {minutes} minutes {seconds} secondes
      </div>
    );
  };

  return (
    <div className="dateList">
      <CreateDate onDateAdded={handleDateAdded} />
      <h1>Vos BirthDate</h1>

      <div className="birthDeck">
        {search.map((date) => (
          <div className="birthCard" key={date._id + "date"}>
            <span className="birthCard-name">
              <b>{date.name}</b>
            </span>
            <span>
              <b>{date.surname}</b>
            </span>
            <br />
            <span className="age">{calculateAge(date.date)} Ans</span>
            <br />
            <span className="date">
              {new Date(date.date).toLocaleDateString("fr-FR")}
            </span>
            <br />

            <div className="birthCard-delete">
              {deleteId !== date._id && (
                <div>
                  <span className="daysUntilBirthday">
                    <h3>Prochain Anniversaire:</h3>{" "}
                    <Countdown
                      daysUntilBirthday={calculateDaysUntilBirthday(date.date)}
                    />
                  </span>
                  <br />
                  <button onClick={() => confirmDelete(date._id)} id="delete">
                    <img src={corbeille2} alt="delete" />
                  </button>
                </div>
              )}
            </div>

            {deleteId === date._id && (
              <div className="birthCard-deleteMode">
                <p>are you sur ?</p>
                <button onClick={cancelDelet} id="delete">
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
        ))}
      </div>
    </div>
  );
};

export default DateList;
