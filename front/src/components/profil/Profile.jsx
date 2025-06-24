import React, { useState, useRef, useEffect, useContext } from "react";
import { AuthContext } from "../../context/auth.context";
import apiHandler from "../../api/apiHandler";
import useAuth from "../../context/useAuth";
import "./css/profile.css";
import PasswordInput from "../connect/PasswordInput";
import Countdown from "../dashboard/Countdown";

const ProfilDetails = () => {
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
    receiveBirthdayEmails: false, // Ajout de ce champ
  });
  const [passwords, setPasswords] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [showPasswordFields, setShowPasswordFields] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [deleteMode, setDeleteMode] = useState(false);
  const [receiveEmails, setReceiveEmails] = useState(false);

  const avatarRef = useRef();

  useEffect(() => {
    let isMounted = true; // Pour éviter les fuites de mémoire
    if (currentUser) {
      apiHandler
        .get(`/users/${currentUser._id}`)
        .then((dbResponse) => {
          if (isMounted) {
            setUserToUpdate(dbResponse.data);
            setReceiveEmails(dbResponse.data.receiveBirthdayEmails); // Initialiser avec la préférence actuelle
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

    fd.append("receiveBirthdayEmails", receiveEmails); // Ajout de cette ligne

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
    }
  };
  const deleteAccount = async (e) => {
    e.preventDefault();
    try {
      await apiHandler.delete(`/users/${userToUpdate._id}`);
      removeUser();
      setDeleteMode(false);
      setIsEditing(false);
    } catch (error) {
      console.error(error);
    }
  };

  const confirmDelete = (e) => {
    e.preventDefault();
    setDeleteMode(true);
  };

  const cancelDelete = (e) => {
    e.preventDefault();
    setDeleteMode(false);
    setIsEditing(true);
  };

  const handleEmailPreferenceChange = async () => {
    try {
      const newPreference = !receiveEmails;
      await apiHandler.patch(`/users/${userToUpdate._id}`, {
        receiveBirthdayEmails: newPreference,
      });
      setReceiveEmails(newPreference);
    } catch (error) {
      console.error("Failed to update email preference:", error);
    }
  };

  if (!currentUser) return <p>Chargement...</p>;

  return (
    <div>
      {isEditing ? (
        <div className="formEdit form-connect">
          <div className="peel">
            <form className="formEditProfile form" onSubmit={sendForm}>
              <h1 className="form-title-font">Modifiez votre profil</h1>
              <input
                type="text"
                className="form-input"
                id="surname"
                value={userToUpdate.surname || ""}
                onChange={(e) => {
                  setUserToUpdate({ ...userToUpdate, surname: e.target.value });
                }}
              />
              <input
                type="text"
                className="form-input"
                id="name"
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
              <div className="password-toggle-container">
                <button
                  type="button"
                  onClick={() => setShowPasswordFields(!showPasswordFields)}
                  className="toggle-password-fields"
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
              <button type="submit">Enregistrer</button>
              <button type="button" onClick={handleCancelEdit}>
                Annuler
              </button>
            </form>
          </div>
          <div className="emailPreference">
            <label>
              <input
                type="checkbox"
                checked={receiveEmails}
                onChange={handleEmailPreferenceChange}
              />
              Notification par e-mails de rappel d'anniversaire
            </label>
          </div>
        </div>
      ) : (
        <div className="profile">
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
              <Countdown birthdate={userToUpdate.birthDate} />
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
        </div>
      )}
    </div>
  );
};

export default ProfilDetails;
