import React, { useContext, useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom"; // ✅ ajouté
import { AuthContext } from "../context/auth.context";
import DateList from "./dashboard/DateList";
import ProfilDetails from "./profil/Profile";
import UpdateDate from "./dashboard/UpdateDate";
import FriendProfile from "./profil/FriendProfile";
import ManualMergeModal from "./dashboard/ManuelMergeModal";
import "./dashboard/css/homePage.css";
import Logo from "./UI/Logo";

const Home = () => {
  const { isLoggedIn, currentUser } = useContext(AuthContext);
  const [searchParams] = useSearchParams(); // ✅ ajouté
  const [date] = useState([]);
  const [showProfile, setShowProfile] = useState(false);
  const [editingDate, setEditingDate] = useState(null);
  const [viewingFriendProfile, setViewingFriendProfile] = useState(null);
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [cardToMerge, setCardToMerge] = useState(null);
  const [profileInitialSection, setProfileInitialSection] =
    useState("personal"); // ✅ ajouté

  // ✅ Ouvrir automatiquement le profil sur l'onglet amis si ?tab=friends
  useEffect(() => {
    const tab = searchParams.get("tab");
    const section = searchParams.get("section");

    if (tab === "friends" && isLoggedIn) {
      setShowProfile(true);
      if (section === "received") {
        setProfileInitialSection("friends");
      } else {
        setProfileInitialSection("friends");
      }
    }
  }, [searchParams, isLoggedIn]);

  const handleShowProfile = () => {
    setShowProfile(true);
    setProfileInitialSection("personal");
    setViewingFriendProfile(null);
    setEditingDate(null);
  };

  const handleHideProfile = () => {
    setShowProfile(false);
    setProfileInitialSection("personal");
  };

  const handleEditDate = (date) => {
    setEditingDate(date);
    setShowProfile(false);
    setViewingFriendProfile(null);
    setShowMergeModal(false);
  };

  const handleCancelEdit = () => {
    setEditingDate(null);
  };

  const handleViewFriendProfile = (date, initialSection = "info") => {
    setViewingFriendProfile({ date, initialSection });
    setShowProfile(false);
    setEditingDate(null);
    setShowMergeModal(false);
  };

  const handleCancelViewProfile = () => {
    setViewingFriendProfile(null);
  };

  const handleOpenMergeModal = (date) => {
    setCardToMerge(date);
    setShowMergeModal(true);
    setEditingDate(null);
  };

  const handleCloseMergeModal = () => {
    setShowMergeModal(false);
    setCardToMerge(null);
  };

  return (
    <div className="homePageRoot">
      <div className="headerApp homePageHeader">
        <Logo className="logoHeader" />
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
          {showProfile &&
            !editingDate &&
            !viewingFriendProfile &&
            !showMergeModal && (
              <>
                <div className="profil-btn">
                  <button
                    onClick={handleHideProfile}
                    className="btnBackToDateList"
                  >
                    ← Retour à la liste
                  </button>
                </div>
                <ProfilDetails initialSection={profileInitialSection} />{" "}
                {/* ✅ prop ajoutée */}
              </>
            )}

          {!showProfile &&
            !editingDate &&
            !viewingFriendProfile &&
            !showMergeModal && (
              <DateList
                onEditDate={handleEditDate}
                onViewFriendProfile={handleViewFriendProfile}
              />
            )}

          {editingDate && !showMergeModal && (
            <UpdateDate
              date={editingDate}
              onCancel={handleCancelEdit}
              onMerge={handleOpenMergeModal}
            />
          )}

          {viewingFriendProfile && !showMergeModal && (
            <FriendProfile
              date={viewingFriendProfile.date}
              initialSection={viewingFriendProfile.initialSection}
              onCancel={handleCancelViewProfile}
            />
          )}

          {showMergeModal && cardToMerge && (
            <ManualMergeModal
              sourceCard={cardToMerge}
              onClose={handleCloseMergeModal}
              onMergeSuccess={handleCloseMergeModal}
            />
          )}
        </>
      )}
    </div>
  );
};

export default Home;
