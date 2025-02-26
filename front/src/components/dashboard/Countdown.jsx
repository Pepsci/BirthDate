import React, { useState, useEffect } from "react";

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

  return (
    <div className="birthCardCountdown">
      <div className="daysContainer">
        <div className="days">{days}</div>
        <span className="daysLabel"> Days</span>
      </div>
      <div className="hoursContainer">
        <div className="hours">{hours}</div>
        <span className="hoursLabel"> Hours</span>
      </div>
      <div className="minutesContainer">
        <div className="minutes">{minutes}</div>
        <span className="minutesLabel"> Minutes</span>
      </div>
      <div className="secondsContainer">
        <div className="seconds">{seconds}</div>
        <span className="secondsLabel"> Seconds</span>
      </div>
    </div>
  );
};

export default Countdown;
