import React, { useState } from "react";
import Countdown from "../dashboard/Countdown";
import GiftForm from "../profil/CreateFriendGiftList";
import GiftItem from "../profil/GiftItem";

const FriendProfile = ({ date, onCancel }) => {
  const [currentDate, setCurrentDate] = useState(date);

  const handleGiftAdded = (updatedDate) => {
    setCurrentDate(updatedDate);
  };

  const handleGiftUpdated = (updatedDate) => {
    setCurrentDate(updatedDate);
  };

  const handleGiftDeleted = (updatedDate) => {
    setCurrentDate(updatedDate);
  };

  const calculateAge = (birthdate) => {
    const birthDate = new Date(birthdate);
    const today = new Date();

    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    const dayDiff = today.getDate() - birthDate.getDate();

    if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
      age--;
    }

    return age;
  };

  return (
    <div className="friendProfile">
      <h1 className="titleFont">
        Profile de {currentDate.name} {currentDate.surname}
      </h1>
      <div className="birthCard titleFont" key={currentDate._id + "date"}>
        <div className="birthCardName">
          <span className="birthCard-name">
            <b>{currentDate.name}</b>
          </span>
          <span>
            <b>{currentDate.surname}</b>
          </span>
          <br />
        </div>
        <div className="birthCardAge">
          <span className="age">{calculateAge(currentDate.date)} Ans</span>
          <br />
        </div>
        <div className="birthCardDate">
          <span className="date">
            {new Date(currentDate.date).toLocaleDateString("fr-FR")}
          </span>
          <br />
        </div>
        <div className="birthCardCenter">
          <span className="daysUntilBirthday">
            <Countdown birthdate={currentDate.date} />
          </span>
        </div>
      </div>

      {/* Formulaire pour ajouter des cadeaux */}
      <GiftForm dateId={currentDate._id} onGiftAdded={handleGiftAdded} />

      {/* Liste des cadeaux */}
      <div className="giftList">
        <h2>Liste des cadeaux</h2>
        <ul>
          {currentDate.gifts.map((gift) => (
            <GiftItem
              key={gift._id}
              gift={gift}
              dateId={currentDate._id}
              onGiftUpdated={handleGiftUpdated}
              onGiftDeleted={handleGiftDeleted}
            />
          ))}
        </ul>
      </div>

      <button type="button" onClick={onCancel} className="btnBack">
        Retour à la liste des dates
      </button>
    </div>
  );
};

export default FriendProfile;
