import React, { useState, useRef, useEffect, useContext } from "react";
import useNotifications from "../../context/useNotifications";
import { AuthContext } from "../../context/auth.context";
import apiHandler from "../../api/apiHandler";
import useAuth from "../../context/useAuth";
import PasswordInput from "../connect/PasswordInput";
import Countdown from "../dashboard/Countdown";
import GestionNotification from "./GestionNotifications";
import Wishlist from "./Wishlist";
import FriendsMobileView from "../friends/FriendsMobileView";
import MergeDuplicatesSection from "../friends/MergeDuplicatesSection";
import ThemeToggle from "./ThemeToggle";
import "../UI/css/carousel-common.css";
import "../UI/css/containerInfo.css";
import "./css/profile.css";
import "./css/profileDesktop.css";
import "../friends/css/friend.css";
import "../connect/authpage.css";
import "../dashboard/css/updateDate.css";

const ProfilDetails = ({
  initialSection = "personal",
  onBack,
  onViewFriendProfile,
}) => {
  const { logOut } = useContext(AuthContext);
  const { friendRequestCount, clearFriendRequestCount } = useNotifications();
  const { currentUser, isLoggedin, removeUser, storeToken, authenticateUser } =
    useAuth();

  const [userToUpdate, setUserToUpdate] = useState({
    _id: "",
    name: "",
    surname: "",
    email: "",
    avatar: "",
    birthDate: "",
    nameday: "",
    receiveBirthdayEmails: false,
  });

  const [passwords, setPasswords] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const [showPasswordFields, setShowPasswordFields] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [receiveEmails, setReceiveEmails] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [showErrorMessage, setShowErrorMessage] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const sections = [
    { id: "personal", title: "Profil", icon: "👤" },
    { id: "notifications", title: "Notifications", icon: "🔔" },
    { id: "friends", title: "Amis", icon: "👥" },
    { id: "merge", title: "Doublons", icon: "🔄" },
    { id: "wishlist", title: "Ma wishlist", icon: "🎁" },
  ];

  const getInitialIndex = () => {
    const index = sections.findIndex((s) => s.id === initialSection);
    return index !== -1 ? index : 0;
  };

  const [currentCarouselIndex, setCurrentCarouselIndex] =
    useState(getInitialIndex);
  const [activeDesktopSection, setActiveDesktopSection] =
    useState(initialSection);

  const [loadedSections, setLoadedSections] = useState(() => {
    const initial = {
      personal: false,
      notifications: false,
      friends: false,
      merge: false,
      wishlist: false,
    };
    initial[initialSection] = true;
    return initial;
  });

  const avatarRef = useRef();

  useEffect(() => {
    let isMounted = true;
    if (currentUser) {
      apiHandler
        .get(`/users/${currentUser._id}`)
        .then((dbResponse) => {
          if (isMounted) {
            setUserToUpdate(dbResponse.data);
            setReceiveEmails(dbResponse.data.receiveBirthdayEmails);
            setLoadedSections((prev) => ({ ...prev, personal: true }));
          }
        })
        .catch((error) => {
          if (isMounted) console.error(error);
        });
    }
    return () => {
      isMounted = false;
    };
  }, [isLoggedin, currentUser]);

  useEffect(() => {
    const currentSection = sections[currentCarouselIndex];
    if (!loadedSections[currentSection.id]) {
      setLoadedSections((prev) => ({ ...prev, [currentSection.id]: true }));
    }
    if (currentSection.id === "friends") clearFriendRequestCount();
  }, [currentCarouselIndex]);

  useEffect(() => {
    if (!loadedSections[activeDesktopSection]) {
      setLoadedSections((prev) => ({ ...prev, [activeDesktopSection]: true }));
    }
    if (activeDesktopSection === "friends") clearFriendRequestCount();
  }, [activeDesktopSection]);

  useEffect(() => {
    let timer;
    if (showSuccessMessage) {
      timer = setTimeout(() => {
        removeUser();
        window.location.href = "/";
      }, 3000);
    }
    return () => clearTimeout(timer);
  }, [showSuccessMessage, removeUser]);

  const handleEditMode = (e) => {
    e.preventDefault();
    setIsEditing(true);
  };

  const handleCancelEdit = (e) => {
    e.preventDefault();
    setIsEditing(false);
    setPasswords({ currentPassword: "", newPassword: "", confirmPassword: "" });
    setShowPasswordFields(false);
  };

  const handleDeleteAccount = (e) => {
    e.preventDefault();
    setShowDeleteModal(true);
  };

  const handleCancelDelete = () => {
    setShowDeleteModal(false);
    setDeleteConfirmText("");
  };

  const handleConfirmDelete = async () => {
    if (deleteConfirmText.toLowerCase() !== "supprimer") {
      setErrorMessage(
        "Veuillez taper 'supprimer' pour confirmer la suppression de votre compte.",
      );
      setShowErrorMessage(true);
      return;
    }
    setIsDeleting(true);
    try {
      await apiHandler.delete(`/users/${currentUser._id}`);
      setShowDeleteModal(false);
      setShowSuccessMessage(true);
    } catch (error) {
      console.error("Erreur lors de la suppression:", error);
      setIsDeleting(false);
      setShowDeleteModal(false);
      setDeleteConfirmText("");
      if (error.response?.status === 403) {
        setErrorMessage("Vous n'êtes pas autorisé à supprimer ce compte.");
      } else if (error.response?.status === 404) {
        setErrorMessage("Compte introuvable.");
      } else {
        setErrorMessage(
          "Une erreur est survenue lors de la suppression du compte. Veuillez réessayer.",
        );
      }
      setShowErrorMessage(true);
    }
  };

  const sendForm = async (e) => {
    e.preventDefault();
    const fd = new FormData();
    fd.append("username", userToUpdate.username || "");
    fd.append("name", userToUpdate.name || "");
    fd.append("email", userToUpdate.email || "");
    if (userToUpdate.birthDate) {
      fd.append("birthDate", new Date(userToUpdate.birthDate).toISOString());
    }
    if (userToUpdate.nameday) {
      fd.append("nameday", userToUpdate.nameday);
    }
    if (avatarRef.current && avatarRef.current.files[0]) {
      fd.append("avatar", avatarRef.current.files[0]);
    }
    if (
      showPasswordFields &&
      (passwords.currentPassword ||
        passwords.newPassword ||
        passwords.confirmPassword)
    ) {
      if (passwords.newPassword !== passwords.confirmPassword) {
        alert("Les nouveaux mots de passe ne correspondent pas.");
        return;
      }
      fd.append("currentPassword", passwords.currentPassword);
      fd.append("newPassword", passwords.newPassword);
    }
    fd.append("receiveBirthdayEmails", receiveEmails);
    try {
      const dbResponse = await apiHandler.patch(
        `/users/${userToUpdate._id}`,
        fd,
        {
          headers: { "content-type": "multipart/form-data" },
        },
      );
      storeToken(dbResponse.data.authToken);
      authenticateUser();
      setUserToUpdate(dbResponse.data.payload);
      setIsEditing(false);
      setPasswords({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
      setShowPasswordFields(false);
    } catch (error) {
      console.error(error);
      if (error.response?.data?.message) alert(error.response.data.message);
    }
  };

  const renderSectionContent = (sectionId, isLoaded) => {
    if (!isLoaded)
      return (
        <div className="loading">
          <p>Chargement...</p>
        </div>
      );

    switch (sectionId) {
      case "personal":
        return (
          <div>
            <p className="profile_info_details">
              <b>
                {currentUser?.name} {currentUser?.surname}
              </b>
            </p>
            <p className="profile_info_details">
              <b>{currentUser?.email}</b>
            </p>
            <p className="profile_info_details">
              <b>Date de naissance:</b>{" "}
              {userToUpdate.birthDate
                ? new Date(userToUpdate.birthDate).toLocaleDateString()
                : "N/A"}
            </p>
            <p className="profile_info_details">
              <b>Fête:</b>{" "}
              {userToUpdate.nameday ? (
                new Date(`2000-${userToUpdate.nameday}`).toLocaleDateString(
                  "fr-FR",
                  {
                    day: "numeric",
                    month: "long",
                  },
                )
              ) : (
                <span style={{ fontStyle: "italic", opacity: 0.7 }}>
                  Non définie
                </span>
              )}
            </p>
            {userToUpdate.birthDate && (
              <div className="profil-countdown">
                <Countdown birthdate={userToUpdate.birthDate} />
              </div>
            )}
            <ThemeToggle />
            <div className="profil-btn" style={{ marginTop: "20px" }}>
              <button
                className="btn-profil btn-carousel"
                onClick={handleEditMode}
              >
                Modifier
              </button>
              <button className="btn-profil btn-carousel" onClick={logOut}>
                LogOut
              </button>
            </div>
          </div>
        );
      case "notifications":
        return <GestionNotification />;
      case "friends":
        return (
          <FriendsMobileView
            currentUser={currentUser}
            onViewFriendProfile={onViewFriendProfile}
          />
        );
      case "merge":
        return <MergeDuplicatesSection />;
      case "wishlist":
        return <Wishlist />;
      default:
        return null;
    }
  };

  if (!currentUser) return <p>Chargement...</p>;

  return (
    <div>
      {/* ── MODAL SUPPRESSION ── */}
      {showDeleteModal && (
        <div className="delete-modal-overlay" onClick={handleCancelDelete}>
          <div className="delete-modal" onClick={(e) => e.stopPropagation()}>
            <h2>⚠️ Supprimer votre compte</h2>
            <p>
              Cette action est <strong>irréversible</strong>. Toutes vos données
              seront définitivement supprimées.
            </p>
            <p>
              Pour confirmer, tapez <strong>"supprimer"</strong> ci-dessous :
            </p>
            <input
              type="text"
              className="auth-input"
              placeholder="Tapez 'supprimer'"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              autoFocus
              disabled={isDeleting}
            />
            <div className="delete-modal-buttons">
              <button
                className="update-btn-secondary"
                onClick={handleCancelDelete}
                disabled={isDeleting}
              >
                Annuler
              </button>
              <button
                className="update-btn-danger"
                onClick={handleConfirmDelete}
                disabled={
                  deleteConfirmText.toLowerCase() !== "supprimer" || isDeleting
                }
              >
                {isDeleting ? "Suppression..." : "Supprimer définitivement"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL SUCCÈS SUPPRESSION ── */}
      {showSuccessMessage && (
        <div className="success-message-overlay">
          <div className="success-message">
            <div className="success-icon">✓</div>
            <h2>Compte supprimé avec succès</h2>
            <p>Vous allez être redirigé vers l'accueil...</p>
          </div>
        </div>
      )}

      {/* ── MODAL ERREUR ── */}
      {showErrorMessage && (
        <div
          className="error-message-overlay"
          onClick={() => setShowErrorMessage(false)}
        >
          <div className="error-message" onClick={(e) => e.stopPropagation()}>
            <div className="error-icon">✕</div>
            <h2>Erreur</h2>
            <p>{errorMessage}</p>
            <button
              className="error-message-button"
              onClick={() => setShowErrorMessage(false)}
            >
              OK
            </button>
          </div>
        </div>
      )}

      {/* ── MODE ÉDITION ── */}
      {isEditing ? (
        <div className="auth-page">
          <div className="auth-shell profile-edit-shell">
            <div className="auth-panel">
              <div className="auth-panel-header">
                <h2 className="auth-title">Modifier votre profil</h2>
                <p className="auth-sub">
                  Mettez à jour vos informations personnelles
                </p>
              </div>

              <form onSubmit={sendForm} className="auth-form">
                <div className="auth-row">
                  <div className="auth-field">
                    <label className="auth-label">Prénom</label>
                    <input
                      type="text"
                      className="auth-input"
                      placeholder="Prénom"
                      value={userToUpdate.surname || ""}
                      onChange={(e) =>
                        setUserToUpdate({
                          ...userToUpdate,
                          surname: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="auth-field">
                    <label className="auth-label">Nom</label>
                    <input
                      type="text"
                      className="auth-input"
                      placeholder="Nom"
                      value={userToUpdate.name || ""}
                      onChange={(e) =>
                        setUserToUpdate({
                          ...userToUpdate,
                          name: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>

                <div className="auth-field">
                  <label className="auth-label">Date de naissance</label>
                  <input
                    type="date"
                    className="auth-input auth-input--date"
                    value={
                      userToUpdate.birthDate
                        ? userToUpdate.birthDate.split("T")[0]
                        : ""
                    }
                    onChange={(e) =>
                      setUserToUpdate({
                        ...userToUpdate,
                        birthDate: e.target.value,
                      })
                    }
                  />
                </div>

                <div className="auth-field">
                  <label className="auth-label">Date de fête (optionnel)</label>
                  <input
                    type="text"
                    className="auth-input"
                    placeholder="MM-JJ (ex: 03-13)"
                    value={userToUpdate.nameday || ""}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === "" || /^\d{0,2}-?\d{0,2}$/.test(value)) {
                        setUserToUpdate({ ...userToUpdate, nameday: value });
                      }
                    }}
                    maxLength={5}
                  />
                  <span className="auth-input-hint">
                    Format MM-JJ — exemple : 03-13 pour le 13 mars
                  </span>
                </div>

                <button
                  type="button"
                  className="profile-toggle-password"
                  onClick={() => setShowPasswordFields(!showPasswordFields)}
                >
                  {showPasswordFields
                    ? "Annuler le changement de mot de passe"
                    : "Changer le mot de passe"}
                </button>

                {showPasswordFields && (
                  <>
                    <div className="auth-field">
                      <label className="auth-label">Mot de passe actuel</label>
                      <PasswordInput
                        className="auth-input"
                        placeholder="••••••••"
                        value={passwords.currentPassword}
                        onChange={(e) =>
                          setPasswords({
                            ...passwords,
                            currentPassword: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div className="auth-field">
                      <label className="auth-label">Nouveau mot de passe</label>
                      <PasswordInput
                        className="auth-input"
                        placeholder="••••••••"
                        value={passwords.newPassword}
                        onChange={(e) =>
                          setPasswords({
                            ...passwords,
                            newPassword: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div className="auth-field">
                      <label className="auth-label">
                        Confirmer le nouveau mot de passe
                      </label>
                      <PasswordInput
                        className="auth-input"
                        placeholder="••••••••"
                        value={passwords.confirmPassword}
                        onChange={(e) =>
                          setPasswords({
                            ...passwords,
                            confirmPassword: e.target.value,
                          })
                        }
                      />
                    </div>
                  </>
                )}

                <div className="update-actions">
                  <button type="submit" className="auth-btn-primary">
                    Enregistrer
                  </button>
                  <button
                    type="button"
                    className="update-btn-secondary"
                    onClick={handleCancelEdit}
                  >
                    Annuler
                  </button>
                </div>

                <div className="update-delete-zone">
                  <button
                    type="button"
                    className="update-btn-delete-trigger"
                    onClick={handleDeleteAccount}
                  >
                    Supprimer mon compte
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      ) : (
        <div className="profile-wrapper">
          {onBack && (
            <button
              onClick={onBack}
              className="btnBackToDateList desktop-back-btn"
            >
              ← Retour
            </button>
          )}

          <div className="profile">
            {/* ── 📱 CARROUSEL MOBILE ── */}
            <div className="mobile-carousel-container">
              <div className="mobile-carousel">
                <div className="mobile-carousel__content">
                  <div className="mobile-section">
                    {onBack && (
                      <div className="mobile-back-btn">
                        <button onClick={onBack} className="btnBackToDateList">
                          ← Retour
                        </button>
                      </div>
                    )}
                    {renderSectionContent(
                      sections[currentCarouselIndex].id,
                      loadedSections[sections[currentCarouselIndex].id],
                    )}
                  </div>
                </div>
                <div className="mobile-carousel__indicators">
                  {sections.map((_, index) => (
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
                    {sections.map((section, index) => (
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
                        {section.id === "friends" && friendRequestCount > 0 && (
                          <span className="notification-badge-quick">
                            {friendRequestCount}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* ── 💻 DESKTOP layout ── */}
            <div className="desktop-profile-container">
              <aside className="desktop-sidebar">
                {sections.map((section) => (
                  <button
                    key={section.id}
                    onClick={() => setActiveDesktopSection(section.id)}
                    className={`sidebar-btn ${
                      activeDesktopSection === section.id ? "active" : ""
                    }`}
                  >
                    <span className="sidebar-icon">{section.icon}</span>
                    <span className="sidebar-text">{section.title}</span>
                    {section.id === "friends" && friendRequestCount > 0 && (
                      <span className="sidebar-notification-badge notification-badge-profile">
                        {friendRequestCount}
                      </span>
                    )}
                  </button>
                ))}
              </aside>
              <main className="desktop-content containerInfo">
                {renderSectionContent(
                  activeDesktopSection,
                  loadedSections[activeDesktopSection],
                )}
              </main>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfilDetails;
