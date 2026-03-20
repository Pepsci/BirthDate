import React, { useState, useEffect } from "react";
import useNotifications from "../../context/useNotifications";
import apiHandler from "../../api/apiHandler";
import { useNavigate } from "react-router-dom";
import Countdown from "./Countdown";
import "./css/birthcard.css";

const BirthdayCard = ({ date, onEdit, onViewProfile, onOpenChat }) => {
  const navigate = useNavigate();
  const { conversationUnreads } = useNotifications();
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [existingEventId, setExistingEventId] = useState(null);

  const isFriend = !!date.linkedUser;

  const unreadForFriend =
    isFriend && date.conversationId
      ? conversationUnreads[date.conversationId] || 0
      : 0;

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    // Vérifier si un événement existe déjà pour cette personne (User ou Date manuelle)
    const personId = date.linkedUser?._id || date.linkedUser || date._id;
    if (personId) {
      apiHandler.get(`/events/check/${personId}`)
        .then(res => {
          if (res.data.exists) setExistingEventId(res.data.shortId);
        })
        .catch(err => console.error("Error checking event", err));
    }
  }, [date]);

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
      (today.getMonth() === birth.getMonth() &&
        today.getDate() < birth.getDate())
    ) {
      age--;
    }

    return age;
  };

  const handleMessageClick = () => {
    if (isMobile) {
      const friendId = date.linkedUser?._id || date.linkedUser;
      const friendName = `${date.name} ${date.surname}`;
      if (onOpenChat) {
        onOpenChat(friendId, friendName);
      }
    } else {
      onViewProfile(date, "chat");
    }
  };

  const today = new Date();
  const birthDate = parseLocalDate(date.date); // ✅ parseLocalDate au lieu de new Date()

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

  const isTomorrow = diffDays === 1;
  const isThisWeek = diffDays <= 7 && diffDays > 1;
  const hasGifts = date.gifts && date.gifts.length > 0;
  const isFamily = date.family === true;

  const cardClassName = `
    birthCard titleFont 
    ${isToday ? "today" : ""} 
    ${isTomorrow ? "tomorrow" : isThisWeek ? "thisWeek" : ""}
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
          {parseLocalDate(date.date).toLocaleDateString("fr-FR")}
        </span>
        {(date.nameday || date.linkedUser?.nameday) && (
          <span
            className="nameday"
            style={{
              display: "block",
              fontSize: "0.85em",
              opacity: 0.8,
              marginTop: "4px",
            }}
          >
            🎉 Fête:{" "}
            {new Date(
              `2000-${date.nameday || date.linkedUser?.nameday}`,
            ).toLocaleDateString("fr-FR", {
              day: "numeric",
              month: "long",
            })}
          </span>
        )}
      </div>

      <div className="birthCard-actions birthCardCenter">
        <span className="daysUntilBirthday">
          <Countdown birthdate={date.date} />
        </span>

        <div className="button-group">
          {!isFriend && (
            <button 
              onClick={() => {
                if (existingEventId) navigate(`/event/${existingEventId}`);
                else navigate(`/events/new?forDate=${date._id}&name=${date.name}&date=${date.date}`);
              }} 
              className="btn-event"
              style={{ background: "var(--primary)", color: "#fff", border: "none" }}
            >
              {existingEventId ? "🎉 Voir l'Évènement" : "🎉 Événement"}
            </button>
          )}
          <button onClick={() => onViewProfile(date)} className="btn-view">
            Voir Profil
          </button>
          {isFriend && (
            <button 
              onClick={() => {
                if (existingEventId) navigate(`/event/${existingEventId}`);
                else navigate(`/events/new?forPerson=${date.linkedUser?._id || date.linkedUser}&name=${date.name}&date=${date.date}`);
              }} 
              className="btn-event-friend"
              style={{ background: "var(--primary)", color: "#fff", border: "none", padding: "5px 10px", borderRadius: "5px", fontSize: "0.85rem", cursor: "pointer" }}
            >
              {existingEventId ? "🎉 Voir l'Évènement" : "🎉 Événement"}
            </button>
          )}
          {isFriend && (
            <button onClick={handleMessageClick} className="btn-message">
              💬 Chat
              {unreadForFriend > 0 && (
                <span className="notification-badge-inline">
                  {unreadForFriend}
                </span>
              )}
            </button>
          )}
        </div>
        {!isFriend && (
          <button 
            onClick={() => onEdit(date)} 
            className="btn-edit-tiny"
            style={{ position: "absolute", top: "10px", right: "10px", background: "transparent", border: "none", color: "var(--text-tertiary)", cursor: "pointer", fontSize: "0.8rem" }}
            title="Modifier la date"
          >
            <i className="fa-solid fa-pen"></i>
          </button>
        )}
      </div>
    </div>
  );
};

export default BirthdayCard;
