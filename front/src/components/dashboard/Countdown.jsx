import React, { useState, useEffect } from "react";
import "./css/countdown.css"; // Nous allons créer ce fichier CSS à l'étape suivante

const Countdown = ({ birthdate }) => {
  const calculateTimeLeft = () => {
    const birthDate = new Date(birthdate);
    const now = new Date();
    let nextBirthday = new Date(
      now.getFullYear(),
      birthDate.getMonth(),
      birthDate.getDate()
    );

    if (nextBirthday < now) {
      nextBirthday.setFullYear(now.getFullYear() + 1);
    }

    return nextBirthday - now;
  };

  const [timeLeft, setTimeLeft] = useState(calculateTimeLeft());
  const [extraTime, setExtraTime] = useState(false);
  const [isLastDay, setIsLastDay] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      const newTimeLeft = calculateTimeLeft();
      const now = new Date();
      const birthDate = new Date(birthdate);
      const todayBirthday = new Date(
        now.getFullYear(),
        birthDate.getMonth(),
        birthDate.getDate()
      );

      // Vérifier si c'est le dernier jour avant l'anniversaire
      const days = Math.floor(newTimeLeft / (1000 * 60 * 60 * 24));
      setIsLastDay(days === 0);

      if (
        newTimeLeft <= 0 &&
        now.getDate() === todayBirthday.getDate() &&
        now.getMonth() === todayBirthday.getMonth()
      ) {
        setExtraTime(true);
      } else if (extraTime && newTimeLeft <= -24 * 60 * 60 * 1000) {
        setExtraTime(false);
      }

      setTimeLeft(newTimeLeft);
    }, 1000);

    return () => clearInterval(timer);
  }, [birthdate, extraTime]);

  if (isNaN(timeLeft)) {
    return null;
  }

  const displayTimeLeft = extraTime ? 24 * 60 * 60 * 1000 + timeLeft : timeLeft;
  const days = Math.floor(displayTimeLeft / (1000 * 60 * 60 * 24));
  const hours = Math.floor(
    (displayTimeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
  );
  const minutes = Math.floor(
    (displayTimeLeft % (1000 * 60 * 60)) / (1000 * 60)
  );
  const seconds = Math.floor((displayTimeLeft % (1000 * 60)) / 1000);

  const [isMobile, setIsMobile] = useState(window.innerWidth <= 600);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 600);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  if (isMobile) {
    return (
      <div
        className={`birthCardCountdown mobile ${isLastDay ? "lastDay" : ""}`}
      >
        <div className="daysContainer">
          <div className="days">{days}</div>
          <span className="daysLabel">J</span>
        </div>
        <div className="hoursContainer">
          <div className="hours">{hours}</div>
          <span className="hoursLabel">H</span>
        </div>
        <div className="minutesContainer">
          <div className="minutes">{minutes}</div>
          <span className="minutesLabel">M</span>
        </div>
        <div className="secondsContainer">
          <div className="seconds">{seconds}</div>
          <span className="secondsLabel">S</span>
        </div>
      </div>
    );
  }
  // Rendu standard pour desktop
  return (
    <div className={`birthCardCountdown ${isLastDay ? "lastDay" : ""}`}>
      <div className="daysContainer">
        <div className="days">{days}</div>
        <span className="daysLabel">Jours</span>
      </div>
      <div className="hoursContainer">
        <div className="hours">{hours}</div>
        <span className="hoursLabel">Heures</span>
      </div>
      <div className="minutesContainer">
        <div className="minutes">{minutes}</div>
        <span className="minutesLabel">Min.</span>
      </div>
      <div className="secondsContainer">
        <div className="seconds">{seconds}</div>
        <span className="secondsLabel">Sec.</span>
      </div>
    </div>
  );
};

export default Countdown;
