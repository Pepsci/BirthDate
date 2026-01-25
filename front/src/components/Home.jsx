import React, { useContext, useState } from "react";
import { AuthContext } from "../context/auth.context";
import DateList from "./dashboard/DateList";
import ProfilDetails from "./profil/Profile";
import UpdateDate from "./dashboard/UpdateDate";
import FriendProfile from "./profil/FriendProfile";
import ManualMergeModal from "./dashboard/ManuelMergeModal"; // 👈 AJOUTÉ
import "./dashboard/css/homePage.css";
import Logo from "./dashboard/images/LogoNomCouleur.png";

const Home = () => {
  const { isLoggedIn, currentUser } = useContext(AuthContext);
  const [date] = useState([]);
  const [showProfile, setShowProfile] = useState(false);
  const [editingDate, setEditingDate] = useState(null);
  const [viewingFriendProfile, setViewingFriendProfile] = useState(null);

  // 👇 AJOUTÉ - État pour le modal de fusion
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [cardToMerge, setCardToMerge] = useState(null);

  const handleShowProfile = () => {
    setShowProfile(true);
    setViewingFriendProfile(null);
    setEditingDate(null);
  };

  const handleHideProfile = () => {
    setShowProfile(false);
  };

  const handleEditDate = (date) => {
    setEditingDate(date);
    setShowProfile(false);
    setViewingFriendProfile(null);
    setShowMergeModal(false); // 👈 AJOUTÉ
  };

  const handleCancelEdit = () => {
    setEditingDate(null);
  };

  const handleViewFriendProfile = (date) => {
    setViewingFriendProfile(date);
    setShowProfile(false);
    setEditingDate(null);
    setShowMergeModal(false); // 👈 AJOUTÉ
  };

  const handleCancelViewProfile = () => {
    setViewingFriendProfile(null);
  };

  // 👇 AJOUTÉ - Handler pour ouvrir le modal de fusion
  const handleOpenMergeModal = (date) => {
    setCardToMerge(date);
    setShowMergeModal(true);
    setEditingDate(null); // Fermer l'édition
  };

  // 👇 AJOUTÉ - Handler pour fermer le modal et recharger
  const handleCloseMergeModal = () => {
    setShowMergeModal(false);
    setCardToMerge(null);
  };

  return (
    <div className="homePageRoot">
      <div className="headerApp homePageHeader">
        <img src={Logo} className="logoHeader" alt="BirthReminder" />
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
          {showProfile &&
            !editingDate &&
            !viewingFriendProfile &&
            !showMergeModal && (
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
          {!showProfile &&
            !editingDate &&
            !viewingFriendProfile &&
            !showMergeModal && (
              <DateList
                onEditDate={handleEditDate}
                onViewFriendProfile={handleViewFriendProfile}
              />
            )}

          {/* Afficher l'édition de date */}
          {editingDate && !showMergeModal && (
            <UpdateDate
              date={editingDate}
              onCancel={handleCancelEdit}
              onMerge={handleOpenMergeModal} // 👈 AJOUTÉ
            />
          )}

          {/* Afficher le profil d'ami */}
          {viewingFriendProfile && !showMergeModal && (
            <FriendProfile
              date={viewingFriendProfile}
              onCancel={handleCancelViewProfile}
            />
          )}

          {/* 👇 AJOUTÉ - Modal de fusion */}
          {showMergeModal && cardToMerge && (
            <ManualMergeModal
              sourceCard={cardToMerge}
              onClose={handleCloseMergeModal}
              onMergeSuccess={() => {
                handleCloseMergeModal();
                // La liste se rechargera automatiquement
              }}
            />
          )}
        </>
      )}
    </div>
  );
};

export default Home;
