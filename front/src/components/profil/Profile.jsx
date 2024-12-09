import React, { useState, useRef, useEffect } from "react";
import apiHandler from "../../api/apiHandler";
import useAuth from "../../context/useAuth";

const ProfilDetails = () => {
  const { currentUser, isLoggedin, removeUser, storeToken, authenticateUser } =
    useAuth();

  const [userToUpdate, setUserToUpdate] = useState({
    _id: "",
    name: "",
    surname: "",
    email: "",
    avatar: "",
    birthDate: "", // Initialisation comme chaîne vide
  });

  const [isEditing, setIsEditing] = useState(false);
  const [deleteMode, setDeleteMode] = useState(false);

  const avatarRef = useRef();

  useEffect(() => {
    let isMounted = true; // Pour éviter les fuites de mémoire
    if (currentUser) {
      console.log("ID utilisateur : ", currentUser._id);
      apiHandler
        .get(`/users/${currentUser._id}`) // Correction de l'URL
        .then((dbResponse) => {
          if (isMounted) {
            setUserToUpdate(dbResponse.data);
            console.log("Données utilisateur : ", dbResponse.data); // Vérifier les données reçues
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

    try {
      const dbResponse = await apiHandler.patch(
        `/users/${userToUpdate._id}`, // Correction de l'URL
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
    } catch (error) {
      console.error(error);
    }
  };

  const deleteAccount = async (e) => {
    e.preventDefault();
    try {
      await apiHandler.delete(`/users/${userToUpdate._id}`); // Correction de l'URL
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

  if (!currentUser) return <p>Chargement...</p>;

  return (
    <div>
      {isEditing ? (
        <div className="formEdit">
          <form className="formEditProfile" onSubmit={sendForm}>
            <label htmlFor="surname">Nom</label>
            <input
              type="text"
              className="formEditProfileInput"
              id="surname"
              value={userToUpdate.surname || ""}
              onChange={(e) => {
                setUserToUpdate({ ...userToUpdate, surname: e.target.value });
              }}
            />
            <label htmlFor="name">Prenom</label>
            <input
              type="text"
              className="formEditProfileInput"
              id="name"
              value={userToUpdate.name || ""}
              onChange={(e) => {
                setUserToUpdate({ ...userToUpdate, name: e.target.value });
              }}
            />
            <label htmlFor="email">Email</label>
            <input
              type="email"
              id="email"
              className="formEditProfileInput"
              value={userToUpdate.email || ""}
              onChange={(e) => {
                setUserToUpdate({ ...userToUpdate, email: e.target.value });
              }}
            />
            <label htmlFor="birthDate">Votre date d'anniversaire</label>
            <input
              type="date"
              id="birthDate"
              className="formEditProfileInput"
              value={
                userToUpdate.birthDate
                  ? userToUpdate.birthDate.split("T")[0]
                  : ""
              }
              onChange={(e) => {
                setUserToUpdate({ ...userToUpdate, birthDate: e.target.value });
              }}
            />
            <label htmlFor="avatar">Avatar</label>
            <input
              type="file"
              id="avatar"
              ref={avatarRef}
              className="formEditProfileInput"
              style={{ display: "none" }}
            />
            <button type="submit">Save</button>
            <button type="button" onClick={handleCancelEdit}>
              Cancel
            </button>
          </form>
        </div>
      ) : (
        <div className="profile">
          <p>Page de profil de {currentUser && currentUser.name}!</p>
          <p>{currentUser && currentUser.surname}</p>
          <p>{currentUser && currentUser.email}</p>
          <p>
            date :{" "}
            {userToUpdate.birthDate
              ? new Date(userToUpdate.birthDate).toLocaleDateString()
              : "N/A"}
          </p>
          <button onClick={handleEditMode}>Edit</button>
        </div>
      )}
    </div>
  );
};

export default ProfilDetails;
