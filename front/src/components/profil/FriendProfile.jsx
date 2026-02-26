import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Countdown from "../dashboard/Countdown";
import FriendGiftList from "./FriendGiftList";
import DirectChat from "../chat/DirectChat";
import ChatModal from "../chat/ChatModal";
import GiftOfferedModal from "../friends/GiftOfferedModal";
import apiHandler from "../../api/apiHandler";
import useAuth from "../../context/useAuth";
import "../UI/css/gifts-common.css";
import "../UI/css/carousel-common.css";
import "./css/friendNotifications.css";
import "./css/friendProfile.css";
import "./css/profileDesktop.css";

const REMINDER_OPTIONS = [
  { value: 1, label: "1 jour avant" },
  { value: 3, label: "3 jours avant" },
  { value: 7, label: "1 semaine avant" },
  { value: 14, label: "2 semaines avant" },
  { value: 30, label: "1 mois avant" },
];

const MENU_SECTIONS_FRIEND = [
  { id: "info", title: "Infos", icon: "👤" },
  { id: "notifications", title: "Notifications", icon: "🔔" },
  { id: "wishlist", title: "Sa Wishlist", icon: "🎁" },
  { id: "gifts", title: "Mes Cadeaux", icon: "📦" },
  { id: "chat", title: "Messages", icon: "💬" },
];

const MENU_SECTIONS_DEFAULT = [
  { id: "info", title: "Infos", icon: "👤" },
  { id: "notifications", title: "Notifications", icon: "🔔" },
  { id: "gifts", title: "Cadeaux", icon: "🎁" },
];

// ─────────────────────────────────────────────────────────────────────────────

const FriendProfile = ({ date, onCancel, initialSection = "info" }) => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  // ── State ──────────────────────────────────────────────────────────────────
  const [currentDate, setCurrentDate] = useState(date);
  const [isLoading, setIsLoading] = useState(false);

  // Notifications
  const [receiveNotifications, setReceiveNotifications] = useState(true);
  const [notificationTimings, setNotificationTimings] = useState([1]);
  const [notifyOnBirthday, setNotifyOnBirthday] = useState(false);
  const [originalPreferences, setOriginalPreferences] = useState({
    timings: [1],
    notifyOnBirthday: false,
  });
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [saveStatus, setSaveStatus] = useState("idle");

  // Wishlist
  const [wishlist, setWishlist] = useState([]);
  const [wishlistLoading, setWishlistLoading] = useState(false);
  const [hasPublicWishlist, setHasPublicWishlist] = useState(false);
  const [giftOfferedModal, setGiftOfferedModal] = useState(null);
  const [giftOfferedSuccess, setGiftOfferedSuccess] = useState(null);

  // Navigation
  const [activeSection, setActiveSection] = useState(initialSection);
  const [currentCarouselIndex, setCurrentCarouselIndex] = useState(0);
  const [isChatModalOpen, setIsChatModalOpen] = useState(false);

  const menuSections = date.linkedUser
    ? MENU_SECTIONS_FRIEND
    : MENU_SECTIONS_DEFAULT;
  const friendId = date.linkedUser?._id || date.linkedUser;

  // ── Effects ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (date.linkedUser) loadFriendWishlist();
  }, [date.linkedUser]);

  useEffect(() => {
    const timings = currentDate.notificationPreferences?.timings || [1];
    const notifyOnBday =
      currentDate.notificationPreferences?.notifyOnBirthday || false;

    setReceiveNotifications(currentDate.receiveNotifications !== false);
    setNotificationTimings(timings);
    setNotifyOnBirthday(notifyOnBday);
    setOriginalPreferences({
      timings: [...timings],
      notifyOnBirthday: notifyOnBday,
    });
    setSaveStatus("idle");
    setHasUnsavedChanges(false);
  }, [currentDate]);

  // ── Helpers ────────────────────────────────────────────────────────────────
  const calculateAge = (birthdate) => {
    const birth = new Date(birthdate);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    if (
      today.getMonth() < birth.getMonth() ||
      (today.getMonth() === birth.getMonth() &&
        today.getDate() < birth.getDate())
    )
      age--;
    return age;
  };

  const checkForChanges = (newTimings, newNotifyOnBirthday) => {
    const changed =
      JSON.stringify([...newTimings].sort()) !==
        JSON.stringify([...originalPreferences.timings].sort()) ||
      newNotifyOnBirthday !== originalPreferences.notifyOnBirthday;
    setHasUnsavedChanges(changed);
    setSaveStatus(changed ? "hasChanges" : "saved");
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

  // ── Wishlist handlers ──────────────────────────────────────────────────────
  const loadFriendWishlist = async () => {
    try {
      setWishlistLoading(true);
      const userId = date.linkedUser?._id || date.linkedUser;
      if (!userId) return;

      const response = await apiHandler.get(`/wishlist/user/${userId}`);
      const raw = response.data.success ? response.data.data : response.data;
      const items = Array.isArray(raw) ? raw.filter((i) => i.isShared) : [];

      setWishlist(items);
      setHasPublicWishlist(items.length > 0);
    } catch (error) {
      console.error("❌ Erreur chargement wishlist:", error);
    } finally {
      setWishlistLoading(false);
    }
  };

  const handleReserve = async (itemId) => {
    try {
      await apiHandler.post(`/wishlist/${itemId}/reserve`, {
        userId: currentUser._id,
      });
      loadFriendWishlist();
    } catch (error) {
      console.error("Erreur réservation:", error);
    }
  };

  const handleUnreserve = async (itemId) => {
    try {
      await apiHandler.post(`/wishlist/${itemId}/unreserve`, {
        userId: currentUser._id,
      });
      loadFriendWishlist();
    } catch (error) {
      console.error("Erreur annulation réservation:", error);
    }
  };

  const handleGiftOfferedConfirm = async ({ occasion, year }) => {
    try {
      await apiHandler.post(`/wishlist/${giftOfferedModal._id}/gift-offered`, {
        userId: currentUser._id,
        dateId: currentDate._id,
        occasion,
        year,
      });
      setGiftOfferedSuccess(giftOfferedModal._id);
      setGiftOfferedModal(null);
      loadFriendWishlist();
      setTimeout(() => setGiftOfferedSuccess(null), 3000);
    } catch (error) {
      console.error("Erreur gift-offered:", error);
    }
  };

  // ── Notification handlers ──────────────────────────────────────────────────
  const handleReceiveNotificationsChange = async (e) => {
    const newValue = e.target.checked;
    setReceiveNotifications(newValue);
    try {
      setIsLoading(true);
      const updated = await apiHandler.toggleDateNotifications(
        currentDate._id,
        newValue,
      );
      setCurrentDate(updated);
    } catch {
      setReceiveNotifications(!newValue);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTimingChange = (value) => {
    const newTimings = notificationTimings.includes(value)
      ? notificationTimings.filter((r) => r !== value)
      : [...notificationTimings, value];
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
      const updated = await apiHandler.updateDateNotificationPreferences(
        currentDate._id,
        {
          timings: notificationTimings,
          notifyOnBirthday,
        },
      );
      setCurrentDate(updated);
      setOriginalPreferences({
        timings: [...notificationTimings],
        notifyOnBirthday,
      });
      setHasUnsavedChanges(false);
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2000);
    } catch {
      setSaveStatus("error");
      setTimeout(
        () => setSaveStatus(hasUnsavedChanges ? "hasChanges" : "idle"),
        3000,
      );
    } finally {
      setIsLoading(false);
    }
  };

  // ── Sections ───────────────────────────────────────────────────────────────
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

  const renderNotificationsSection = () => {
    const buttonConfig = getButtonConfig();
    return (
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
          {REMINDER_OPTIONS.map((option) => (
            <div
              key={option.value}
              className="friend-notification-timing-option"
            >
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
    );
  };

  const renderWishlistSection = () => {
    if (wishlistLoading)
      return (
        <div className="loading">
          <p>Chargement de la wishlist...</p>
        </div>
      );

    if (!hasPublicWishlist)
      return (
        <div className="gift-empty">
          <div className="empty-icon">🔒</div>
          <h4>Wishlist privée</h4>
          <p>{currentDate.name} n'a pas partagé sa wishlist publiquement.</p>
        </div>
      );

    const visibleItems = wishlist.filter((item) => {
      if (!item.reservedBy) return true;
      const reservedById =
        item.reservedBy?._id?.toString() || item.reservedBy?.toString();
      return reservedById === currentUser._id?.toString();
    });

    return (
      <div className="wishlist-section">
        <h2>🎁 Sa Wishlist</h2>
        <div className="gift-items">
          {visibleItems.map((item) => {
            const isReservedByMe =
              item.reservedBy?._id?.toString() ===
                currentUser._id?.toString() ||
              item.reservedBy?.toString() === currentUser._id?.toString();
            const isOfferedByMe = giftOfferedSuccess === item._id;

            return (
              <div
                key={item._id}
                className={`gift-item-card ${isReservedByMe ? "gift-item-card--reserved-by-me" : ""} ${item.isPurchased ? "gift-item-card--purchased" : ""}`}
              >
                <div className="gift-item-horizontal">
                  {item.image && (
                    <div className="gift-item-img-wrapper">
                      <img
                        src={item.image}
                        alt={item.title}
                        onError={(e) => {
                          e.target.parentElement.style.display = "none";
                        }}
                      />
                    </div>
                  )}

                  <div className="gift-item-content">
                    <div className="gift-item-header">
                      <h4 className="gift-item-title">{item.title}</h4>
                      {item.isPurchased && (
                        <span className="gift-item-badge purchased">
                          ✅ Offert
                        </span>
                      )}
                      {!item.isPurchased && isReservedByMe && (
                        <span className="gift-item-badge reserved">
                          🎁 Réservé par moi
                        </span>
                      )}
                    </div>

                    {item.description && (
                      <p className="gift-item-description">
                        {item.description}
                      </p>
                    )}

                    <div className="gift-item-footer">
                      {item.price && (
                        <span className="gift-item-price">{item.price} €</span>
                      )}
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
                    </div>

                    {isOfferedByMe && (
                      <p className="gift-item-success">
                        ✅ Cadeau ajouté à ta liste !
                      </p>
                    )}

                    {!item.isPurchased && (
                      <div className="gift-item-actions">
                        {!item.reservedBy ? (
                          <div className="gift-item-actions-row">
                            <button
                              className="btn-gift btn-reserve"
                              onClick={() => handleReserve(item._id)}
                            >
                              🎁 Je le réserve
                            </button>
                            <button
                              className="btn-gift btn-offered"
                              onClick={() => setGiftOfferedModal(item)}
                            >
                              ✅ Je l'ai offert
                            </button>
                          </div>
                        ) : isReservedByMe ? (
                          <div className="gift-item-actions-row">
                            <button
                              className="btn-gift btn-unreserve"
                              onClick={() => handleUnreserve(item._id)}
                            >
                              ↩️ Annuler ma réservation
                            </button>
                            <button
                              className="btn-gift btn-offered"
                              onClick={() => setGiftOfferedModal(item)}
                            >
                              ✅ Je l'ai offert
                            </button>
                          </div>
                        ) : (
                          <p className="gift-item-reserved-by">
                            🧑 Réservé par{" "}
                            {item.reservedBy?.name
                              ? `${item.reservedBy.name}${item.reservedBy.surname ? " " + item.reservedBy.surname : ""}`
                              : "Un ami"}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderGiftsSection = () => (
    <FriendGiftList currentDate={currentDate} onUpdate={setCurrentDate} />
  );

  const renderChatSection = () => {
    if (!friendId)
      return (
        <div className="error-message">
          Cet utilisateur n'est pas lié à un compte ami
        </div>
      );
    return (
      <div className="chat-section-desktop">
        <DirectChat friendId={friendId} />
      </div>
    );
  };

  const renderSection = (sectionId) => {
    switch (sectionId) {
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

  // ── Render ─────────────────────────────────────────────────────────────────
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
            {menuSections[currentCarouselIndex]?.id !== "chat" && (
              <div className="mobile-section">
                {renderSection(menuSections[currentCarouselIndex]?.id)}
              </div>
            )}
          </div>

          <div className="mobile-carousel__indicators">
            {menuSections
              .filter((s) => s.id !== "chat")
              .map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentCarouselIndex(index)}
                  className={`mobile-carousel__indicator ${index === currentCarouselIndex ? "mobile-carousel__indicator--active" : ""}`}
                  aria-label={`Aller à la section ${index + 1}`}
                />
              ))}
          </div>

          <div className="mobile-carousel__quick-nav">
            <div className="mobile-carousel__quick-buttons">
              {menuSections.map((section, index) => (
                <button
                  key={section.id}
                  onClick={() =>
                    section.id === "chat"
                      ? setIsChatModalOpen(true)
                      : setCurrentCarouselIndex(index)
                  }
                  className={`mobile-carousel__quick-btn ${
                    (section.id === "chat" && isChatModalOpen) ||
                    (section.id !== "chat" && index === currentCarouselIndex)
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
          {renderSection(activeSection)}
        </div>
      </div>

      {/* MODAL CHAT - Mobile */}
      {friendId && (
        <ChatModal
          isOpen={isChatModalOpen}
          onClose={() => {
            setIsChatModalOpen(false);
            setCurrentCarouselIndex(0);
            setActiveSection("info");
          }}
          title={`${date.name} ${date.surname}`}
        >
          <DirectChat friendId={friendId} />
        </ChatModal>
      )}

      {/* MODAL J'AI OFFERT CE CADEAU */}
      {giftOfferedModal && (
        <GiftOfferedModal
          item={giftOfferedModal}
          onConfirm={handleGiftOfferedConfirm}
          onCancel={() => setGiftOfferedModal(null)}
        />
      )}
    </div>
  );
};

export default FriendProfile;
