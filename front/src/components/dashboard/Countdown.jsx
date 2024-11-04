import React, { useState, useEffect } from "react";

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
