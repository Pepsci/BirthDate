import React, { useState, useEffect } from "react";
import Countdown from "../dashboard/Countdown";
import FriendGiftList from "./FriendGiftList";
import apiHandler from "../../api/apiHandler";
import "./css/notifications.css";
import "./css/friendProfile.css";
import "./css/friendcarousel.css";

const FriendProfile = ({ date, onCancel }) => {
  const [currentDate, setCurrentDate] = useState(date);
  const [receiveNotifications, setReceiveNotifications] = useState(true);
  const [notificationTimings, setNotificationTimings] = useState([1]);
  const [notifyOnBirthday, setNotifyOnBirthday] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // État pour le carrousel mobile
  const [currentCarouselIndex, setCurrentCarouselIndex] = useState(0);

  // Nouveaux états pour gérer les changements
  const [originalPreferences, setOriginalPreferences] = useState({
    timings: [1],
    notifyOnBirthday: false,
  });
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [saveStatus, setSaveStatus] = useState("idle");

  const reminderOptions = [
    { value: 1, label: "1 jour avant" },
    { value: 3, label: "3 jours avant" },
    { value: 7, label: "1 semaine avant" },
    { value: 14, label: "2 semaines avant" },
    { value: 30, label: "1 mois avant" },
  ];

  // 👇 Sections du carrousel
  const carouselSections = [
    { id: "info", title: "Infos", icon: "👤" },
    { id: "notifications", title: "Notifications", icon: "🔔" },
    { id: "gifts", title: "Cadeaux", icon: "🎁" },
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

      setOriginalPreferences({
        timings: [...initialTimings],
        notifyOnBirthday: initialNotifyOnBirthday,
      });

      setSaveStatus("idle");
      setHasUnsavedChanges(false);
    }

    loadNotificationPreferences();
  }, [currentDate]);

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

  const handleGiftUpdated = (updatedDate) => {
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

      setOriginalPreferences({
        timings: [...notificationTimings],
        notifyOnBirthday: notifyOnBirthday,
      });

      setHasUnsavedChanges(false);
      setSaveStatus("saved");

      setTimeout(() => {
        setSaveStatus("idle");
      }, 2000);
    } catch (error) {
      console.error("Failed to save notification preferences:", error);
      setSaveStatus("error");

      setTimeout(() => {
        setSaveStatus(hasUnsavedChanges ? "hasChanges" : "idle");
      }, 3000);
    } finally {
      setIsLoading(false);
    }
  };

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

  // 👇 Navigation carrousel
  const goToPrevious = () => {
    setCurrentCarouselIndex(
      currentCarouselIndex > 0
        ? currentCarouselIndex - 1
        : carouselSections.length - 1
    );
  };

  const goToNext = () => {
    setCurrentCarouselIndex(
      currentCarouselIndex < carouselSections.length - 1
        ? currentCarouselIndex + 1
        : 0
    );
  };

  // 👇 Rendu des sections mobiles
  const renderMobileSection = () => {
    const currentSection = carouselSections[currentCarouselIndex];

    switch (currentSection.id) {
      case "info":
        return (
          <div className="mobile-section">
            <div className="birthCardAge">
              <span className="age">{calculateAge(currentDate.date)} Ans</span>
              <div className="date-profilFriend font-profilFriend">
                {new Date(currentDate.date).toLocaleDateString("fr-FR")}
              </div>
              <Countdown birthdate={currentDate.date} />
            </div>
          </div>
        );

      case "notifications":
        return (
          <div className="mobile-section">
            <div className="notificationPreferences">
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
                    ? "Notifications activées"
                    : "Notifications désactivées"}
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
          </div>
        );

      case "gifts":
        return (
          <div className="mobile-section">
            <FriendGiftList
              currentDate={currentDate}
              onUpdate={handleGiftUpdated}
            />
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="friendProfil">
      {/* <h1 className="name-profilFriend font-profilFriend">
        {currentDate.name} {currentDate.surname}
      </h1> */}

      {/* 👇 CARROUSEL MOBILE */}
      <div className="mobile-carousel-container">
        <div className="mobile-carousel">
          {/* <div className="mobile-carousel__header">
            <span className="mobile-carousel__icon">
              {carouselSections[currentCarouselIndex].icon}
            </span>
            <h3 className="mobile-carousel__title">
              {carouselSections[currentCarouselIndex].title}
            </h3>
          </div> */}

          <div className="mobile-carousel__content">
            {renderMobileSection()}

            {/* <button
              onClick={goToPrevious}
              className="mobile-carousel__nav-btn mobile-carousel__nav-btn--prev"
              aria-label="Section précédente"
            >
              <ChevronLeft size={20} color="#495057" />
            </button>

            <button
              onClick={goToNext}
              className="mobile-carousel__nav-btn mobile-carousel__nav-btn--next"
              aria-label="Section suivante"
            >
              <ChevronRight size={20} color="#495057" />
            </button> */}
          </div>

          <div className="mobile-carousel__indicators">
            {carouselSections.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentCarouselIndex(index)}
                className={`mobile-carousel__indicator ${
                  index === currentCarouselIndex
                    ? "mobile-carousel__indicator--active"
                    : ""
                }`}
                aria-label={`Aller à la section ${index + 1}`}
              />
            ))}
          </div>

          <div className="mobile-carousel__quick-nav">
            {/* <span className="mobile-carousel__counter">
              {currentCarouselIndex + 1} / {carouselSections.length}
            </span> */}
            <div className="mobile-carousel__quick-buttons">
              {carouselSections.map((section, index) => (
                <button
                  key={section.id}
                  onClick={() => setCurrentCarouselIndex(index)}
                  className={`mobile-carousel__quick-btn ${
                    index === currentCarouselIndex
                      ? "mobile-carousel__quick-btn--active"
                      : ""
                  }`}
                  aria-label={section.title}
                >
                  {section.icon}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 👇 AFFICHAGE DESKTOP CLASSIQUE */}
      <div className="grid-friendProfil desktop-view">
        <div className="info-friendProfil grid1-friendProfil">
          <div className="birthCardAge">
            <span className="age">{calculateAge(currentDate.date)} Ans</span>
            <div className="date-profilFriend font-profilFriend">
              {new Date(currentDate.date).toLocaleDateString("fr-FR")}
            </div>
            <Countdown birthdate={currentDate.date} />
          </div>
        </div>

        <div className="notificationPreferences grid2-friendProfil">
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
          <FriendGiftList
            currentDate={currentDate}
            onUpdate={handleGiftUpdated}
          />
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
