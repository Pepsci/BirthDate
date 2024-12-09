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
    date: "",
  });

  const [isEditing, setIsEditing] = useState(false);
  const [deleteMode, setDeleteMode] = useState(false);

  const avatarRef = useRef();

  useEffect(() => {
    if (currentUser) {
      console.log("useeeeeeeeeeeeeer", currentUser._id);
      apiHandler
        .get(`/users/${currentUser._id}`)
        .then((dbResponse) => {
          setUserToUpdate(dbResponse.data);
        })
        .catch((error) => {
          console.error(error);
        });
    }
    if (!isLoggedin) {
      setUserToUpdate(null);
    }
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
    fd.append("username", userToUpdate.username);
    fd.append("name", userToUpdate.name);
    fd.append("email", userToUpdate.email);
    fd.append("date", userToUpdate.date);
    if (avatarRef.current.files[0]) {
      fd.append("avatar", avatarRef.current.files[0]);
    }

    try {
      const dbResponse = await apiHandler.patch(
        `/user/${userToUpdate._id}`,
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
      await apiHandler.delete(`/user/${userToUpdate._id}`);
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

  if (!currentUser) return <p>Loading...</p>;

  return (
    <div>
      {isEditing ? (
        <div className="formEdit">
          <form className="formEditProfile" onSubmit={sendForm}>
            <label htmlFor="name">Nom</label>
            <input
              type="text"
              className="formEditProfileInput"
              value={userToUpdate.surname || ""}
              onChange={(e) => {
                setUserToUpdate({ ...userToUpdate, surname: e.target.value });
              }}
            />
            <label htmlFor="name">Prenom</label>
            <input
              type="text"
              className="formEditProfileInput"
              value={userToUpdate.name || ""}
              onChange={(e) => {
                setUserToUpdate({ ...userToUpdate, name: e.target.value });
              }}
            />
            <label htmlFor="email">Email</label>
            <input
              type="email"
              name="email"
              className="formEditProfileInput"
              value={userToUpdate.email || ""}
              onChange={(e) => {
                setUserToUpdate({ ...userToUpdate, email: e.target.value });
              }}
            />
            {/* Ajoute le reste des champs ici */}
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
          <p>{currentUser && currentUser.date}</p>
          <button onClick={handleEditMode}>Edit</button>
        </div>
      )}
    </div>
  );
};

export default ProfilDetails;
