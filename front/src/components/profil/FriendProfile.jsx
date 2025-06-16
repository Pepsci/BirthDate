import React, { useState, useEffect } from "react";
import Countdown from "../dashboard/Countdown";
import GiftForm from "../profil/CreateFriendGiftList";
import GiftItem from "../profil/GiftItem";
import apiHandler from "../../api/apiHandler";
import "./css/notifications.css";
import "./css/friendProfile.css";

const FriendProfile = ({ date, onCancel }) => {
  const [currentDate, setCurrentDate] = useState(date);
  const [receiveNotifications, setReceiveNotifications] = useState(true);
  const [notificationTimings, setNotificationTimings] = useState([1]); // Par défaut 1 jour avant
  const [notifyOnBirthday, setNotifyOnBirthday] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Options de rappel disponibles
  const reminderOptions = [
    { value: 1, label: "1 jour avant" },
    { value: 3, label: "3 jours avant" },
    { value: 7, label: "1 semaine avant" },
    { value: 14, label: "2 semaines avant" },
    { value: 30, label: "1 mois avant" },
  ];

  useEffect(() => {
    // Charger les préférences de notification pour cette date
    function loadNotificationPreferences() {
      // Initialiser à partir de l'état de l'objet currentDate
      setReceiveNotifications(currentDate.receiveNotifications !== false); // true par défaut si non défini

      // Si les préférences de notification existent
      if (currentDate.notificationPreferences) {
        setNotificationTimings(
          currentDate.notificationPreferences.timings || [1]
        );
        setNotifyOnBirthday(
          currentDate.notificationPreferences.notifyOnBirthday || false
        );
      }
    }

    loadNotificationPreferences();
  }, [currentDate]);

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

  const handleReceiveNotificationsChange = async (e) => {
    const newValue = e.target.checked;
    setReceiveNotifications(newValue);

    try {
      setIsLoading(true);
      const updatedDate = await apiHandler.toggleDateNotifications(
        currentDate._id,
        newValue
      );

      // Mettre à jour l'état local
      setCurrentDate(updatedDate);
    } catch (error) {
      console.error("Failed to update notification preference:", error);
      // Remettre à l'état précédent en cas d'erreur
      setReceiveNotifications(!newValue);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTimingChange = (value) => {
    // Si la valeur est déjà dans le tableau, la retirer, sinon l'ajouter
    if (notificationTimings.includes(value)) {
      setNotificationTimings(notificationTimings.filter((r) => r !== value));
    } else {
      setNotificationTimings([...notificationTimings, value]);
    }
  };

  const handleSaveNotificationPreferences = async () => {
    try {
      setIsLoading(true);
      const updatedDate = await apiHandler.updateDateNotificationPreferences(
        currentDate._id,
        {
          timings: notificationTimings,
          notifyOnBirthday: notifyOnBirthday,
        }
      );

      // Mettre à jour l'état local
      setCurrentDate(updatedDate);
    } catch (error) {
      console.error("Failed to save notification preferences:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="friendProfil">
      {/* Section info profil */}
      <h1 className="name-profilFriend font-profilFriend">
        {currentDate.name} {currentDate.surname}
      </h1>
      <div className="grid-friendProfil">
        <div className="info-friendProfil grid1-friendProfil">
          <div className="birthCardAge">
            <span className="age">{calculateAge(currentDate.date)} Ans</span>
            <br />
            <span className="date-profilFriend font-profilFriend">
              {new Date(currentDate.date).toLocaleDateString("fr-FR")}
            </span>
            <Countdown birthdate={currentDate.date} />
          </div>
        </div>

        {/* Section des préférences de notification */}
        <div className="notificationPreferences gri2-friendProfil">
          <h2>Préférences de notification</h2>

          <div className="notification-toggle">
            <label className="switch">
              <input
                type="checkbox"
                checked={receiveNotifications}
                onChange={handleReceiveNotificationsChange}
                disabled={isLoading}
              />
              <span className="slider round"></span>
            </label>
            <span>
              {receiveNotifications
                ? "Notifications activées pour cet anniversaire"
                : "Notifications désactivées pour cet anniversaire"}
            </span>
          </div>

          <div className="notificationFrequency-friendProfil">
            <h3>Quand souhaitez-vous être notifié ?</h3>

            <div className="timing-option">
              <label>
                <input
                  type="checkbox"
                  checked={notifyOnBirthday}
                  onChange={(e) => setNotifyOnBirthday(e.target.checked)}
                  disabled={isLoading || !receiveNotifications}
                />
                Le jour même
              </label>
            </div>

            {reminderOptions.map((option) => (
              <div key={option.value} className="timing-option">
                <label>
                  <input
                    type="checkbox"
                    checked={notificationTimings.includes(option.value)}
                    onChange={() => handleTimingChange(option.value)}
                    disabled={isLoading || !receiveNotifications}
                  />
                  {option.label}
                </label>
              </div>
            ))}

            <button
              className="save-preferences-btn"
              onClick={handleSaveNotificationPreferences}
              disabled={isLoading || !receiveNotifications}
            >
              Sauvegarder les préférences
            </button>
          </div>
        </div>

        {/* Formulaire pour ajouter des cadeaux */}
        <div className="gift-friendProfil grid3-friendProfil">
          <div className="form-friendProfil">
            <GiftForm dateId={currentDate._id} onGiftAdded={handleGiftAdded} />
          </div>

          {/* Liste des cadeaux */}
          <h2 className="giftTiltle-friendProfil">Liste des cadeaux</h2>
          <div className="giftList-friendProfil">
            <div className="giftName-friendProfil">
              {currentDate.gifts &&
                currentDate.gifts
                  .filter(
                    (gift) => gift !== undefined && gift.giftName && gift._id
                  )
                  .map((gift) => (
                    <GiftItem
                      key={gift._id}
                      gift={gift}
                      dateId={currentDate._id}
                      onUpdate={handleGiftUpdated}
                      onDelete={handleGiftDeleted}
                    />
                  ))}
            </div>
          </div>
        </div>
      </div>

      <button type="button" onClick={onCancel} className="btnBack">
        Retour à la liste des dates
      </button>
    </div>
  );
};

export default FriendProfile;
