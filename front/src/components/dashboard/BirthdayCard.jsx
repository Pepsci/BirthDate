import React from "react";
import Countdown from "./Countdown";
import "./css/birthcard.css";

const BirthdayCard = ({ date, onEdit, onViewProfile }) => {
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
    <div className={cardClassName}>
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
          <span>{calculateCurrentAge(date.date)}</span> <span>Ans</span>
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
          {!isFriend && (
            <button onClick={() => onEdit(date)} className="btn-edit">
              Modifier
            </button>
          )}
          <button onClick={() => onViewProfile(date)} className="btn-view">
            Voir Profil
          </button>
        </div>
      </div>
    </div>
  );
};

export default BirthdayCard;
