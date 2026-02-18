import React from "react";
import useNotifications from "../../context/useNotifications";
import Countdown from "./Countdown";
import "./css/birthcard.css";

const BirthdayCard = ({ date, onEdit, onViewProfile, onOpenChat }) => {
  // 👈 AJOUT onOpenChat
  const { conversationUnreads } = useNotifications();

  const isFriend = !!date.linkedUser;

  // Maintenant c'est simple : juste récupérer le count pour cette conversation
  const unreadForFriend =
    isFriend && date.conversationId
      ? conversationUnreads[date.conversationId] || 0
      : 0;

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

  // 👇 MODIFIER cette fonction
  const handleMessageClick = () => {
    const friendId = date.linkedUser?._id || date.linkedUser;
    const friendName = `${date.name} ${date.surname}`;

    // Appeler la fonction passée en prop pour ouvrir la modal
    if (onOpenChat) {
      onOpenChat(friendId, friendName);
    }
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
          {isFriend && (
            <button onClick={handleMessageClick} className="btn-message">
              💬 Messages
              {unreadForFriend > 0 && (
                <span className="notification-badge-inline">
                  {unreadForFriend}
                </span>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default BirthdayCard;
