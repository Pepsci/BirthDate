import React, { useContext, useState, useEffect, useRef } from "react";
import useNotifications from "../context/useNotifications";
import { useSearchParams, useNavigate } from "react-router-dom";
import { AuthContext } from "../context/auth.context";
import DateList from "./dashboard/DateList";
import ProfilDetails from "./profil/Profile";
import UpdateDate from "./dashboard/UpdateDate";
import FriendProfile from "./profil/FriendProfile";
import ManualMergeModal from "./dashboard/ManuelMergeModal";
import OnboardingModal from "./profil/notifications/OnboardingModal";
import "./dashboard/css/homePage.css";
import Logo from "./UI/Logo";

const Home = () => {
  const { isLoggedIn, currentUser } = useContext(AuthContext);
  const { friendRequestCount } = useNotifications();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const resetChatRef = useRef(null);

  const [date] = useState([]);
  const [showProfile, setShowProfile] = useState(false);
  const [editingDate, setEditingDate] = useState(null);
  const [viewingFriendProfile, setViewingFriendProfile] = useState(null);
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [cardToMerge, setCardToMerge] = useState(null);
  const [profileInitialSection, setProfileInitialSection] =
    useState("personal");
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [savedPage, setSavedPage] = useState(1); // 👈 NOUVEAU

  // Scroll en haut à chaque changement de vue
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [showProfile, editingDate, viewingFriendProfile, showMergeModal]);

  useEffect(() => {
    if (!isLoggedIn || !currentUser) return;
    const localDone = localStorage.getItem("onboardingDone") === "true";
    if (!localDone && !currentUser.onboardingDone) {
      setShowOnboarding(true);
    } else {
      if (currentUser.onboardingDone) {
        localStorage.setItem("onboardingDone", "true");
      }
    }
  }, [isLoggedIn, currentUser]);

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab === "friends" && isLoggedIn) {
      setShowProfile(true);
      setProfileInitialSection("friends");
    }
  }, [searchParams, isLoggedIn]);

  const handleLogoClick = () => {
    if (resetChatRef.current) resetChatRef.current();
    setShowProfile(false);
    setEditingDate(null);
    setViewingFriendProfile(null);
    setShowMergeModal(false);
    setCardToMerge(null);
    setProfileInitialSection("personal");
    setSavedPage(1); // 👈 Reset page au logo
    navigate("/home");
  };

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

  const handleEditDate = (date, currentPage) => {
    // 👈 reçoit currentPage
    setSavedPage(currentPage);
    setEditingDate(date);
    setShowProfile(false);
    setViewingFriendProfile(null);
    setShowMergeModal(false);
  };

  const handleCancelEdit = () => {
    setEditingDate(null);
  };

  const handleViewFriendProfile = (
    date,
    initialSection = "info",
    currentPage = 1,
  ) => {
    // 👈 reçoit currentPage
    setSavedPage(currentPage);
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
        <button onClick={handleLogoClick} className="logoHeaderBtn">
          <Logo className="logoHeader" />
        </button>
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
                  {friendRequestCount > 0 && (
                    <span className="notification-badge-profile">
                      {friendRequestCount}
                    </span>
                  )}
                </div>
              </button>
            </div>
          </div>
        )}
      </div>

      {showOnboarding && (
        <OnboardingModal onClose={() => setShowOnboarding(false)} />
      )}

      {isLoggedIn && (
        <>
          {showProfile &&
            !editingDate &&
            !viewingFriendProfile &&
            !showMergeModal && (
              <ProfilDetails
                initialSection={profileInitialSection}
                onBack={handleHideProfile}
                onViewFriendProfile={handleViewFriendProfile}
              />
            )}

          {!showProfile &&
            !editingDate &&
            !viewingFriendProfile &&
            !showMergeModal && (
              <DateList
                onEditDate={handleEditDate}
                onViewFriendProfile={handleViewFriendProfile}
                initialPage={savedPage} // 👈 NOUVEAU
                onResetChat={(fn) => {
                  resetChatRef.current = fn;
                }}
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
