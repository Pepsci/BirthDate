import React, { useState, useEffect, useRef, require } from "react";
import apiHandler from "../../api/apiHandler";
import useAuth from "../../context/useAuth";
import CreateDate from "./CreateDate";
import "./css/dateList.css";
import corbeille1 from "./icons/corbeille1.png";
import corbeille2 from "./icons/corbeille2.png";
import annule from "./icons/annule.png";
import { getRandomImage } from "./CadeauxRandom";

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

  const Countdown = ({ birthdate }) => {
    const calculateTimeLeft = () => {
      const birthDate = new Date(birthdate);
      const now = new Date();
      const nextBirthday = new Date(
        now.getFullYear(),
        birthDate.getMonth(),
        birthDate.getDate()
      );
      if (nextBirthday < now) {
        nextBirthday.setFullYear(now.getFullYear() + 1);
      }
      const timeLeft = nextBirthday - now;
      return timeLeft;
    };

    const [timeLeft, setTimeLeft] = useState(calculateTimeLeft());

    useEffect(() => {
      const timer = setInterval(() => {
        setTimeLeft(calculateTimeLeft());
      }, 1000);

      return () => clearInterval(timer);
    }, []);

    const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
    const hours = Math.floor(
      (timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
    );
    const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);

    return (
      <div>
        {days} jours {hours} heures {minutes} minutes {seconds} secondes
      </div>
    );
  };

  const randomImage = getRandomImage();

  return (
    <div className="dateList">
      <CreateDate onDateAdded={handleDateAdded} />
      <h1>Vos BirthDate</h1>

      <div className="birthDeck">
        {search.map((date) => {
          const randomImage = getRandomImage();
          return (
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
                      Jours jusqu'à l'anniversaire:{" "}
                      <Countdown birthdate={date.date} />
                    </span>
                    <br />
                    <img src={randomImage} alt="Random" />
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
          );
        })}
      </div>
    </div>
  );
};

export default DateList;
