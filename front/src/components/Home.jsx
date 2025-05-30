import React, { useContext, useState } from "react";
import { AuthContext } from "../context/auth.context";
import DateList from "./dashboard/DateList";
import ProfilDetails from "./profil/Profile";
import UpdateDate from "./dashboard/UpdateDate";
import FriendProfile from "./profil/FriendProfile";
import "./dashboard/css/homePage.css";

const Home = () => {
  const { isLoggedIn, currentUser } = useContext(AuthContext);
  const [date] = useState([]);
  const [showProfile, setShowProfile] = useState(false);
  const [editingDate, setEditingDate] = useState(null);
  const [viewingFriendProfile, setViewingFriendProfile] = useState(null); // Nouvel état pour gérer l'affichage du profil d'ami

  const handleShowProfile = () => {
    setShowProfile(true);
  };

  const handleHideProfile = () => {
    setShowProfile(false);
  };

  const handleEditDate = (date) => {
    setEditingDate(date);
  };

  const handleCancelEdit = () => {
    setEditingDate(null);
  };

  const handleViewFriendProfile = (date) => {
    setViewingFriendProfile(date);
  };

  const handleCancelViewProfile = () => {
    setViewingFriendProfile(null);
  };

  return (
    <div className="homePageRoot">
      <div className="headerApp homePageHeader">
        <h1 className="titleFont titleFontSize">BirthDate</h1>
        {isLoggedIn && (
          <div className="homePageUser">
            <div className="homePageCurrentUser">
              <button onClick={handleShowProfile} className="btnProfile">
                <div className="btn-currentName">
                  {currentUser && currentUser.name}
                  <img
                    src={`https://api.dicebear.com/8.x/bottts/svg?seed=${currentUser.surname}`}
                    alt="avatar"
                    className="avatar"
                  />
                </div>
              </button>
            </div>
          </div>
        )}
      </div>

      {isLoggedIn &&
        !editingDate &&
        !viewingFriendProfile &&
        (showProfile ? (
          <ProfilDetails />
        ) : (
          <DateList
            onEditDate={handleEditDate}
            onViewFriendProfile={handleViewFriendProfile}
          />
        ))}

      {isLoggedIn && showProfile && (
        <button onClick={handleHideProfile} className="btnBackToDateList">
          Back to Date List
        </button>
      )}

      {editingDate && (
        <UpdateDate date={editingDate} onCancel={handleCancelEdit} />
      )}

      {viewingFriendProfile && (
        <FriendProfile
          date={viewingFriendProfile}
          onCancel={handleCancelViewProfile}
        />
      )}
    </div>
  );
};

export default Home;
