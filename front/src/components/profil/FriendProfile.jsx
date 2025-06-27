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
  const [notificationTimings, setNotificationTimings] = useState([1]);
  const [notifyOnBirthday, setNotifyOnBirthday] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Nouveaux états pour gérer les changements
  const [originalPreferences, setOriginalPreferences] = useState({
    timings: [1],
    notifyOnBirthday: false,
  });
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [saveStatus, setSaveStatus] = useState("idle"); // 'idle', 'saved', 'hasChanges'

  const reminderOptions = [
    { value: 1, label: "1 jour avant" },
    { value: 3, label: "3 jours avant" },
    { value: 7, label: "1 semaine avant" },
    { value: 14, label: "2 semaines avant" },
    { value: 30, label: "1 mois avant" },
  ];

  useEffect(() => {
    function loadNotificationPreferences() {
      setReceiveNotifications(currentDate.receiveNotifications !== false);

      const initialTimings = currentDate.notificationPreferences?.timings || [
        1,
      ];
      const initialNotifyOnBirthday =
        currentDate.notificationPreferences?.notifyOnBirthday || false;

      setNotificationTimings(initialTimings);
      setNotifyOnBirthday(initialNotifyOnBirthday);

      // Sauvegarder les préférences originales
      setOriginalPreferences({
        timings: [...initialTimings],
        notifyOnBirthday: initialNotifyOnBirthday,
      });

      setSaveStatus("idle");
      setHasUnsavedChanges(false);
    }

    loadNotificationPreferences();
  }, [currentDate]);

  // Fonction pour vérifier s'il y a des changements
  const checkForChanges = (newTimings, newNotifyOnBirthday) => {
    const timingsChanged =
      JSON.stringify([...newTimings].sort()) !==
      JSON.stringify([...originalPreferences.timings].sort());
    const birthdayChanged =
      newNotifyOnBirthday !== originalPreferences.notifyOnBirthday;

    const hasChanges = timingsChanged || birthdayChanged;
    setHasUnsavedChanges(hasChanges);
    setSaveStatus(hasChanges ? "hasChanges" : "saved");
  };

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

      setCurrentDate(updatedDate);
    } catch (error) {
      console.error("Failed to update notification preference:", error);
      setReceiveNotifications(!newValue);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTimingChange = (value) => {
    let newTimings;
    if (notificationTimings.includes(value)) {
      newTimings = notificationTimings.filter((r) => r !== value);
    } else {
      newTimings = [...notificationTimings, value];
    }

    setNotificationTimings(newTimings);
    checkForChanges(newTimings, notifyOnBirthday);
  };

  const handleNotifyOnBirthdayChange = (e) => {
    const newValue = e.target.checked;
    setNotifyOnBirthday(newValue);
    checkForChanges(notificationTimings, newValue);
  };

  const handleSaveNotificationPreferences = async () => {
    try {
      setIsLoading(true);
      setSaveStatus("saving");

      const updatedDate = await apiHandler.updateDateNotificationPreferences(
        currentDate._id,
        {
          timings: notificationTimings,
          notifyOnBirthday: notifyOnBirthday,
        }
      );

      setCurrentDate(updatedDate);

      // Mettre à jour les préférences originales après sauvegarde réussie
      setOriginalPreferences({
        timings: [...notificationTimings],
        notifyOnBirthday: notifyOnBirthday,
      });

      setHasUnsavedChanges(false);
      setSaveStatus("saved");

      // Revenir à l'état 'idle' après 2 secondes
      setTimeout(() => {
        setSaveStatus("idle");
      }, 2000);
    } catch (error) {
      console.error("Failed to save notification preferences:", error);
      setSaveStatus("error");

      // Revenir à l'état précédent après 3 secondes
      setTimeout(() => {
        setSaveStatus(hasUnsavedChanges ? "hasChanges" : "idle");
      }, 3000);
    } finally {
      setIsLoading(false);
    }
  };

  // Fonction pour obtenir le texte et la classe du bouton
  const getButtonConfig = () => {
    switch (saveStatus) {
      case "hasChanges":
        return {
          text: "Sauvegarder les préférences",
          className: "save-preferences-btn has-changes",
          disabled: false,
        };
      case "saved":
        return {
          text: "Préférences sauvegardées ✓",
          className: "save-preferences-btn saved",
          disabled: true,
        };
      case "saving":
        return {
          text: "Sauvegarde en cours...",
          className: "save-preferences-btn saving",
          disabled: true,
        };
      case "error":
        return {
          text: "Erreur lors de la sauvegarde",
          className: "save-preferences-btn error",
          disabled: false,
        };
      default:
        return {
          text: "Sauvegarder les préférences",
          className: "save-preferences-btn",
          disabled: true,
        };
    }
  };

  const buttonConfig = getButtonConfig();

  return (
    <div className="friendProfil">
      <h1 className="name-profilFriend font-profilFriend">
        {currentDate.name} {currentDate.surname}
      </h1>
      <div className="grid-friendProfil">
        <div className="info-friendProfil grid1-friendProfil">
          <div className="birthCardAge">
            <span className="age">{calculateAge(currentDate.date)} Ans</span>
            <div className="date-profilFriend font-profilFriend">
              {new Date(currentDate.date).toLocaleDateString("fr-FR")}
            </div>
            <Countdown birthdate={currentDate.date} />
          </div>
        </div>

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
                  onChange={handleNotifyOnBirthdayChange}
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
              className={buttonConfig.className}
              onClick={handleSaveNotificationPreferences}
              disabled={
                buttonConfig.disabled || isLoading || !receiveNotifications
              }
            >
              {buttonConfig.text}
            </button>
          </div>
        </div>

        <div className="gift-friendProfil grid3-friendProfil">
          <div className="form-friendProfil">
            <GiftForm dateId={currentDate._id} onGiftAdded={handleGiftAdded} />
          </div>

          <h2 className="giftTiltle-friendProfil">Vos idées de cadeaux</h2>
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
      <div className="btnRLD">
        <button type="button" onClick={onCancel} className="btnBack">
          Retour à la liste des dates
        </button>
      </div>
    </div>
  );
};

export default FriendProfile;
