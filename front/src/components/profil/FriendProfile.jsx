import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Countdown from "../dashboard/Countdown";
import FriendGiftList from "./FriendGiftList";
import DirectChat from "../chat/DirectChat";
import apiHandler from "../../api/apiHandler";
import "../UI/css/gifts-common.css";
import "../UI/css/carousel-common.css";
import "./css/friendNotifications.css";
import "./css/friendProfile.css";
import "./css/profileDesktop.css";

const FriendProfile = ({ date, onCancel, initialSection = "info" }) => {
  const navigate = useNavigate();
  const [currentDate, setCurrentDate] = useState(date);
  const [receiveNotifications, setReceiveNotifications] = useState(true);
  const [notificationTimings, setNotificationTimings] = useState([1]);
  const [notifyOnBirthday, setNotifyOnBirthday] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const [wishlist, setWishlist] = useState([]);
  const [wishlistLoading, setWishlistLoading] = useState(false);
  const [hasPublicWishlist, setHasPublicWishlist] = useState(false);

  // Pour mobile
  const [currentCarouselIndex, setCurrentCarouselIndex] = useState(0);

  // Pour desktop
  const [activeSection, setActiveSection] = useState(initialSection);

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

  const menuSections = date.linkedUser
    ? [
        { id: "info", title: "Infos", icon: "👤" },
        { id: "notifications", title: "Notifications", icon: "🔔" },
        { id: "wishlist", title: "Sa Wishlist", icon: "🎁" },
        { id: "gifts", title: "Mes Cadeaux", icon: "📦" },
        { id: "chat", title: "Messages", icon: "💬" },
      ]
    : [
        { id: "info", title: "Infos", icon: "👤" },
        { id: "notifications", title: "Notifications", icon: "🔔" },
        { id: "gifts", title: "Cadeaux", icon: "🎁" },
      ];

  // Fonction pour ouvrir le chat dans la section
  const handleOpenChatInSection = () => {
    setActiveSection("chat");
    // Pour mobile, trouve l'index de la section chat
    const chatIndex = menuSections.findIndex(
      (section) => section.id === "chat",
    );
    if (chatIndex !== -1) {
      setCurrentCarouselIndex(chatIndex);
    }
  };

  // Fonction pour ouvrir le chat dans une nouvelle page (depuis les cartes)
  const handleOpenChatNewPage = async () => {
    try {
      const friendId = date.linkedUser?._id || date.linkedUser;
      const response = await apiHandler.post("/conversations/start", {
        friendId,
      });

      if (response.data) {
        navigate("/chat", { state: { selectedConversation: response.data } });
      }
    } catch (error) {
      console.error("Error starting conversation:", error);
    }
  };

  useEffect(() => {
    if (initialSection === "chat") {
      const chatIndex = menuSections.findIndex(
        (section) => section.id === "chat",
      );
      if (chatIndex !== -1) {
        setCurrentCarouselIndex(chatIndex);
      }
    }
  }, [initialSection]);

  useEffect(() => {
    if (date.linkedUser) {
      loadFriendWishlist();
    }
  }, [date.linkedUser]);

  const loadFriendWishlist = async () => {
    try {
      setWishlistLoading(true);

      const userId = date.linkedUser?._id || date.linkedUser;

      if (!userId) {
        setWishlistLoading(false);
        return;
      }

      const response = await apiHandler.get(`/wishlist/user/${userId}`);

      let items = [];

      if (response.data.success && Array.isArray(response.data.data)) {
        items = response.data.data;
      } else if (Array.isArray(response.data)) {
        items = response.data;
      }

      const publicItems = items.filter((item) => item.isShared === true);

      setWishlist(publicItems);
      setHasPublicWishlist(publicItems.length > 0);
      setWishlistLoading(false);
    } catch (error) {
      console.error("❌ Erreur chargement wishlist:", error);
      setWishlistLoading(false);
    }
  };

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
        newValue,
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
        },
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

  // SECTIONS DE CONTENU
  const renderInfoSection = () => (
    <div className="profile_info">
      <h1 className="name-profilFriend font-profilFriend">
        {currentDate.name} {currentDate.surname}
        {date.linkedUser && (
          <span className="friend-badge-profile">👥 AMI</span>
        )}
      </h1>
      <div className="birthCardAge">
        <span className="age">{calculateAge(currentDate.date)} Ans</span>
        <div className="date-profilFriend font-profilFriend">
          {new Date(currentDate.date).toLocaleDateString("fr-FR")}
        </div>
        <Countdown birthdate={currentDate.date} />
      </div>
    </div>
  );

  const renderNotificationsSection = () => (
    <div className="friend-notification">
      <h2>Préférences de notification</h2>

      <div className="friend-notification-toggle">
        <label className="switch">
          <input
            type="checkbox"
            checked={receiveNotifications}
            onChange={handleReceiveNotificationsChange}
            disabled={isLoading}
          />
          <span className="slider round"></span>
        </label>
        <span className="friend-notification-span">
          {receiveNotifications
            ? "Notifications activées pour cet anniversaire"
            : "Notifications désactivées pour cet anniversaire"}
        </span>
      </div>

      <div className="friend-notification-frequency">
        <h3>Quand souhaitez-vous être notifié ?</h3>

        <div className="friend-notification-timing-option">
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
          <div key={option.value} className="friend-notification-timing-option">
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
          disabled={buttonConfig.disabled || isLoading || !receiveNotifications}
        >
          {buttonConfig.text}
        </button>
      </div>
    </div>
  );

  const renderWishlistSection = () => {
    if (wishlistLoading) {
      return (
        <div className="loading">
          <p>Chargement de la wishlist...</p>
        </div>
      );
    }

    if (!hasPublicWishlist) {
      return (
        <div className="gift-empty">
          <div className="empty-icon">🔒</div>
          <h4>Wishlist privée</h4>
          <p>{currentDate.name} n'a pas partagé sa wishlist publiquement.</p>
        </div>
      );
    }

    return (
      <div className="wishlist-section">
        <h2>🎁 Sa Wishlist</h2>
        <div className="gift-items">
          {wishlist.map((item) => (
            <div key={item._id} className="gift-item-card">
              <div className="gift-item-header">
                <h4 className="gift-item-title">{item.title}</h4>
                {item.price && (
                  <span className="gift-item-price">{item.price}€</span>
                )}
              </div>

              {item.url && (
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="gift-item-link"
                >
                  🔗 Voir le produit
                </a>
              )}

              {item.isPurchased && (
                <div className="gift-item-badge purchased">✓ Déjà acheté</div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderGiftsSection = () => (
    <FriendGiftList currentDate={currentDate} onUpdate={handleGiftUpdated} />
  );

  // Section chat avec DirectChat
  const renderChatSection = () => {
    const friendId = date.linkedUser?._id || date.linkedUser;
    return <DirectChat friendId={friendId} />;
  };

  // Rendu de la section active (desktop)
  const renderDesktopContent = () => {
    switch (activeSection) {
      case "info":
        return renderInfoSection();
      case "notifications":
        return renderNotificationsSection();
      case "wishlist":
        return renderWishlistSection();
      case "gifts":
        return renderGiftsSection();
      case "chat":
        return renderChatSection();
      default:
        return renderInfoSection();
    }
  };

  // Rendu mobile (carousel)
  const renderMobileSection = () => {
    const currentSection = menuSections[currentCarouselIndex];

    switch (currentSection.id) {
      case "info":
        return <div className="mobile-section">{renderInfoSection()}</div>;
      case "notifications":
        return (
          <div className="mobile-section">{renderNotificationsSection()}</div>
        );
      case "wishlist":
        return <div className="mobile-section">{renderWishlistSection()}</div>;
      case "gifts":
        return <div className="mobile-section">{renderGiftsSection()}</div>;
      case "chat":
        return <div className="mobile-section">{renderChatSection()}</div>;
      default:
        return null;
    }
  };

  return (
    <div className="friendProfil">
      <div className="btnRLD">
        <button type="button" onClick={onCancel} className="btnBack">
          ← Retour à la liste
        </button>
      </div>

      {/* MOBILE : Carousel */}
      <div className="mobile-carousel-container">
        <div className="mobile-carousel">
          <div className="mobile-carousel__content">
            {renderMobileSection()}
          </div>

          <div className="mobile-carousel__indicators">
            {menuSections.map((_, index) => (
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
            <div className="mobile-carousel__quick-buttons">
              {menuSections.map((section, index) => (
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

      {/* DESKTOP : Sidebar + Content */}
      <div className="desktop-profile-container">
        <div className="desktop-sidebar">
          {menuSections.map((section) => (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              className={`sidebar-btn ${activeSection === section.id ? "active" : ""}`}
            >
              <span className="sidebar-icon">{section.icon}</span>
              <span className="sidebar-text">{section.title}</span>
            </button>
          ))}
        </div>

        <div className="desktop-content containerInfo">
          {renderDesktopContent()}
        </div>
      </div>
    </div>
  );
};

export default FriendProfile;
