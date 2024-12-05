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
    password: "",
  });

  const [isEditing, setIsEditing] = useState(false);
  const [deleteMode, setDeleteMode] = useState(false);

  const avatarRef = useRef();

  useEffect(() => {
    if (currentUser) {
      apiHandler
        .get(`/user/${currentUser._id}`)
        .then((dbResponse) => {
          setUserToUpdate(dbResponse.data);
        })
        .catch((error) => {
          console.log(error);
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

  const canceEdit = (e) => {
    e.preventDefault();
    setIsEditing(false);
  };

  const SendForm = async (e) => {
    e.preventDefault();
    const fd = new FormData();
    fd.append("username", userToUpdate.username);
    fd.append("name", userToUpdate.name);
    fd.append("email", userToUpdate.email);
    fd.append("date", userToUpdate.date);
    fd.append("avatar", avatarRef.current.files[0]);
    console.log("the current avatar ref is:", avatarRef.current.files[0]);
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

      setIsEditing(!isEditing);
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

  if (!currentUser) return <p>loading ...</p>;

  return (
    <div>
      <p>page de profil de {currentUser && currentUser.name}!</p>
      <p>{currentUser && currentUser.surname}</p>
      <p>{currentUser && currentUser.email}</p>
      <p>{currentUser && currentUser.date}</p>
    </div>
  );
};

export default ProfilDetails;
