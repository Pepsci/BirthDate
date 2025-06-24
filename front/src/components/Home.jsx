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
  const [viewingFriendProfile, setViewingFriendProfile] = useState(null);

  const handleShowProfile = () => {
    // Quand on clique sur son profil, on ferme tout le reste
    setShowProfile(true);
    setViewingFriendProfile(null); // Fermer le profil d'ami
    setEditingDate(null); // Fermer l'édition
  };

  const handleHideProfile = () => {
    setShowProfile(false);
  };

  const handleEditDate = (date) => {
    setEditingDate(date);
    setShowProfile(false); // Fermer le profil
    setViewingFriendProfile(null); // Fermer le profil d'ami
  };

  const handleCancelEdit = () => {
    setEditingDate(null);
  };

  const handleViewFriendProfile = (date) => {
    setViewingFriendProfile(date);
    setShowProfile(false); // Fermer notre profil
    setEditingDate(null); // Fermer l'édition
  };

  const handleCancelViewProfile = () => {
    setViewingFriendProfile(null);
  };

  return (
    <div className="homePageRoot">
      <div className="headerApp homePageHeader">
        <h1 className="titleFont titleFontSize">BirthReminder</h1>
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

      {isLoggedIn && (
        <>
          {/* Afficher le profil utilisateur */}
          {showProfile && !editingDate && !viewingFriendProfile && (
            <>
              <ProfilDetails />
              <div className="profil-btn">
                <button
                  onClick={handleHideProfile}
                  className="btnBackToDateList"
                >
                  Back to Date List
                </button>
              </div>
            </>
          )}

          {/* Afficher la liste des dates */}
          {!showProfile && !editingDate && !viewingFriendProfile && (
            <DateList
              onEditDate={handleEditDate}
              onViewFriendProfile={handleViewFriendProfile}
            />
          )}

          {/* Afficher l'édition de date */}
          {editingDate && (
            <UpdateDate date={editingDate} onCancel={handleCancelEdit} />
          )}

          {/* Afficher le profil d'ami */}
          {viewingFriendProfile && (
            <FriendProfile
              date={viewingFriendProfile}
              onCancel={handleCancelViewProfile}
            />
          )}
        </>
      )}
    </div>
  );
};

export default Home;
