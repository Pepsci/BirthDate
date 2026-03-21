import React from "react";
import Countdown from "./Countdown";
import "./css/birthcard.css";

const BirthdayCard = ({ date, onViewProfile }) => {
  const isFriend = !!date.linkedUser;

  // ✅ Parse la date sans conversion timezone
  const parseLocalDate = (dateStr) => {
    const [year, month, day] = dateStr.split("T")[0].split("-");
    return new Date(year, month - 1, day);
  };

  const calculateCurrentAge = (birthDateStr) => {
    const today = new Date();
    const birth = parseLocalDate(birthDateStr);
    let age = today.getFullYear() - birth.getFullYear();
    if (
      today.getMonth() < birth.getMonth() ||
      (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())
    ) age--;
    return age;
  };

  const today = new Date();
  const birthDate = parseLocalDate(date.date);
  const thisYearBirthday = new Date(today.getFullYear(), birthDate.getMonth(), birthDate.getDate());
  let nextBirthday = thisYearBirthday;
  if (thisYearBirthday < today) {
    nextBirthday = new Date(today.getFullYear() + 1, birthDate.getMonth(), birthDate.getDate());
  }
  const diffTime = nextBirthday.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  const isToday = today.getDate() === birthDate.getDate() && today.getMonth() === birthDate.getMonth();
  const isTomorrow = diffDays === 1;
  const isThisWeek = diffDays <= 7 && diffDays > 1;
  const hasGifts = date.gifts && date.gifts.length > 0;
  const isFamily = date.family === true;

  const cardClassName = `birthCard titleFont ${isToday ? "today" : ""} ${isTomorrow ? "tomorrow" : isThisWeek ? "thisWeek" : ""} ${hasGifts ? "has-gifts" : ""} ${isFamily ? "family" : ""} ${isFriend ? "friend-date" : ""}`.trim();

  return (
    <div
      className={cardClassName}
      onClick={() => onViewProfile(date, "info")}
      style={{ cursor: "pointer" }}
    >
      <div className="birthCardName">
        <span className="birthCard-name">
          <b>{date.name}</b>
          {isFriend && <span className="friend-badge">👥 AMI</span>}
          {isFamily && !isFriend && <span className="family-badge">👨‍👩‍👧 FAMILLE</span>}
        </span>
        <span><b>{date.surname}</b></span>
      </div>

      <div className="birthCardAge">
        <span className="age">
          <span>{calculateCurrentAge(date.date)}</span> <span>Ans</span>
        </span>
      </div>

      <div className="birthCardDate">
        <span className="date">
          {parseLocalDate(date.date).toLocaleDateString("fr-FR")}
        </span>
        {(date.nameday || date.linkedUser?.nameday) && (
          <span className="nameday" style={{ display: "block", fontSize: "0.85em", opacity: 0.8, marginTop: "4px" }}>
            🎉 Fête:{" "}
            {new Date(`2000-${date.nameday || date.linkedUser?.nameday}`).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}
          </span>
        )}
      </div>

      <div className="birthCard-actions birthCardCenter">
        <span className="daysUntilBirthday">
          <Countdown birthdate={date.date} />
        </span>
      </div>
    </div>
  );
};

export default BirthdayCard;
