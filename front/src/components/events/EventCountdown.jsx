import React, { useState, useEffect } from "react";
import "../dashboard/css/countdown.css";

const EventCountdown = ({ targetDate }) => {
  const calculateTimeLeft = () => {
    if (!targetDate) return 0;
    return new Date(targetDate) - new Date();
  };

  const [timeLeft, setTimeLeft] = useState(calculateTimeLeft());
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 600);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);
    return () => clearInterval(timer);
  }, [targetDate]);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 600);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const clampedTimeLeft = Math.max(0, isNaN(timeLeft) ? 0 : timeLeft);

  const days = Math.floor(clampedTimeLeft / (1000 * 60 * 60 * 24));
  const hours = Math.floor(
    (clampedTimeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60),
  );
  const minutes = Math.floor(
    (clampedTimeLeft % (1000 * 60 * 60)) / (1000 * 60),
  );
  const seconds = Math.floor((clampedTimeLeft % (1000 * 60)) / 1000);

  const isLastDay = days === 0 && clampedTimeLeft > 0;

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

export default EventCountdown;
