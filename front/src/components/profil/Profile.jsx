import React, { useState, useRef, useEffect, useContext } from "react";
import { AuthContext } from "../../context/auth.context";
import apiHandler from "../../api/apiHandler";
import useAuth from "../../context/useAuth";
import { useNavigate } from "react-router-dom";
import "./css/profile.css";
import "./css/carousel.css";
import PasswordInput from "../connect/PasswordInput";
import Countdown from "../dashboard/Countdown";
import GestionNotification from "./GestionNotifications";
import Wishlist from "./Wishlist";
import { ChevronLeft, ChevronRight } from "lucide-react";

const ProfilDetails = () => {
  const navigate = useNavigate();
  const { logOut } = useContext(AuthContext);
  const { currentUser, isLoggedin, removeUser, storeToken, authenticateUser } =
    useAuth();

  const [userToUpdate, setUserToUpdate] = useState({
    _id: "",
    name: "",
    surname: "",
    email: "",
    avatar: "",
    birthDate: "",
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

  const [currentCarouselIndex, setCurrentCarouselIndex] = useState(0);

  const avatarRef = useRef();

  const carouselSections = [
    { id: "personal", title: "Infos Personnelles", icon: "👤" },
    { id: "notifications", title: "Notifications", icon: "🔔" },
    { id: "wishlist", title: "Ma Wishlist", icon: "🎁" },
  ];

  useEffect(() => {
    let isMounted = true;
    if (currentUser) {
      apiHandler
        .get(`/users/${currentUser._id}`)
        .then((dbResponse) => {
          if (isMounted) {
            setUserToUpdate(dbResponse.data);
            setReceiveEmails(dbResponse.data.receiveBirthdayEmails);
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
    setPasswords({
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    });
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
        "Veuillez taper 'supprimer' pour confirmer la suppression de votre compte."
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
          "Une erreur est survenue lors de la suppression du compte. Veuillez réessayer."
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
          headers: {
            "content-type": "multipart/form-data",
          },
        }
      );
      storeToken(dbResponse.data.authToken);
      authenticateUser();
      setUserToUpdate((prevValue) => dbResponse.data.payload);
      setIsEditing(false);
      setPasswords({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
      setShowPasswordFields(false);
    } catch (error) {
      console.error(error);
      if (error.response?.data?.message) {
        alert(error.response.data.message);
      }
    }
  };

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

  const renderMobileSection = () => {
    const currentSection = carouselSections[currentCarouselIndex];

    switch (currentSection.id) {
      case "personal":
        return (
          <div className="mobile-section">
            <h2>Vos données</h2>
            <p className="profile_info_details">
              <b>
                {currentUser && currentUser.name}{" "}
                {currentUser && currentUser.surname}
              </b>
            </p>
            <p className="profile_info_details">
              <b>{currentUser && currentUser.email}</b>
            </p>
            <p className="profile_info_details">
              <b>Date de naissance:</b>{" "}
              {userToUpdate.birthDate
                ? new Date(userToUpdate.birthDate).toLocaleDateString()
                : "N/A"}
            </p>
            {userToUpdate.birthDate && (
              <div className="profil-countdown">
                <Countdown birthdate={userToUpdate.birthDate} />
              </div>
            )}
            <div className="profil-btn" style={{ marginTop: "20px" }}>
              <button className="btn-profil" onClick={handleEditMode}>
                Modifier
              </button>
              <button className="btn-profil" onClick={logOut}>
                LogOut
              </button>
            </div>
          </div>
        );

      case "notifications":
        return (
          <div className="mobile-section">
            <GestionNotification />
          </div>
        );

      case "wishlist":
        return (
          <div className="mobile-section">
            <Wishlist />
          </div>
        );

      default:
        return null;
    }
  };

  if (!currentUser) return <p>Chargement...</p>;

  return (
    <div>
      {/* Modals (inchangées) */}
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
              className="form-input"
              placeholder="Tapez 'supprimer'"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              autoFocus
              disabled={isDeleting}
            />
            <div className="delete-modal-buttons">
              <button
                className="btn-profil btn-profilGrey"
                onClick={handleCancelDelete}
                disabled={isDeleting}
              >
                Annuler
              </button>
              <button
                className="btn-profil btn-delete"
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

      {showSuccessMessage && (
        <div className="success-message-overlay">
          <div className="success-message">
            <div className="success-icon">✓</div>
            <h2>Compte supprimé avec succès</h2>
            <p>Vous allez être redirigé vers l'accueil...</p>
          </div>
        </div>
      )}

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

      {isEditing ? (
        // Mode édition (inchangé)
        <div className="formEdit form-connect">
          <div className="peel">
            <form className="formEditProfile form" onSubmit={sendForm}>
              <h1 className="form-title-font">Modifiez votre profil</h1>
              <input
                type="text"
                className="form-input"
                id="surname"
                placeholder="Prénom"
                value={userToUpdate.surname || ""}
                onChange={(e) => {
                  setUserToUpdate({ ...userToUpdate, surname: e.target.value });
                }}
              />
              <input
                type="text"
                className="form-input"
                id="name"
                placeholder="Nom"
                value={userToUpdate.name || ""}
                onChange={(e) => {
                  setUserToUpdate({ ...userToUpdate, name: e.target.value });
                }}
              />
              <input
                type="date"
                id="birthDate"
                className="form-input"
                value={
                  userToUpdate.birthDate
                    ? userToUpdate.birthDate.split("T")[0]
                    : ""
                }
                onChange={(e) => {
                  setUserToUpdate({
                    ...userToUpdate,
                    birthDate: e.target.value,
                  });
                }}
              />
              <div className="profile-togglePasswordContainer">
                <button
                  type="button"
                  onClick={() => setShowPasswordFields(!showPasswordFields)}
                  className="profile-togglePassword btn-profil"
                >
                  {showPasswordFields
                    ? "Annuler le changement de mot de passe"
                    : "Changer le mot de passe"}
                </button>
              </div>
              {showPasswordFields && (
                <>
                  <PasswordInput
                    type="password"
                    placeholder="Mot de passe actuel"
                    className="form-input"
                    value={passwords.currentPassword}
                    onChange={(e) =>
                      setPasswords({
                        ...passwords,
                        currentPassword: e.target.value,
                      })
                    }
                  />
                  <PasswordInput
                    type="password"
                    placeholder="Nouveau mot de passe"
                    className="form-input"
                    value={passwords.newPassword}
                    onChange={(e) =>
                      setPasswords({
                        ...passwords,
                        newPassword: e.target.value,
                      })
                    }
                  />
                  <PasswordInput
                    type="password"
                    placeholder="Confirmez le nouveau mot de passe"
                    className="form-input"
                    value={passwords.confirmPassword}
                    onChange={(e) =>
                      setPasswords({
                        ...passwords,
                        confirmPassword: e.target.value,
                      })
                    }
                  />
                </>
              )}
              <div className="btn-profilEditContainer">
                <button className="btn-profil btn-profilGreen" type="submit">
                  Enregistrer
                </button>
                <button
                  className="btn-profil btn-profilGrey"
                  type="button"
                  onClick={handleCancelEdit}
                >
                  Annuler
                </button>
                <button
                  className="btn-profil btn-delete"
                  type="button"
                  onClick={handleDeleteAccount}
                >
                  Supprimer mon compte
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : (
        <div className="profile">
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
                </button> */}

                {/* <button
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

          {/* 👇 AFFICHAGE DESKTOP - MAINTENANT VISIBLE */}
          <div className="profileWrapper">
            <div className="profile_info">
              <h2>Vos données</h2>
              <p className="profile_info_details">
                <b>
                  {currentUser && currentUser.name}{" "}
                  {currentUser && currentUser.surname}
                </b>
              </p>
              <p className="profile_info_details">
                <b>{currentUser && currentUser.email}</b>
              </p>
              <p className="profile_info_details">
                <b>Date de naissance:</b>{" "}
                {userToUpdate.birthDate
                  ? new Date(userToUpdate.birthDate).toLocaleDateString()
                  : "N/A"}
              </p>
              {userToUpdate.birthDate && (
                <div className="profil-countdown">
                  <Countdown birthdate={userToUpdate.birthDate} />
                </div>
              )}
              <div className="profil-btn">
                <button className="btn-profil" onClick={handleEditMode}>
                  Modifier
                </button>
                <button className="btn-profil" onClick={logOut}>
                  LogOut
                </button>
              </div>
            </div>

            <div className="notification">
              <GestionNotification />
            </div>

            {/* 👇 NOUVELLE SECTION WISHLIST POUR DESKTOP */}
            <div className="wishlist-desktop">
              <Wishlist />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfilDetails;
