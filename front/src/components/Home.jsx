import React, { useContext, useState } from "react";
import { Link } from "react-router-dom"; // Import du composant Link
import { AuthContext } from "../context/auth.context";
import DateList from "./dashboard/DateList";
import ProfilDetails from "./profil/Profile"; // Assure-toi d'importer le composant ProfilDetails
import "./dashboard/css/homePage.css";

const Home = () => {
  const { logOut, isLoggedIn, currentUser } = useContext(AuthContext);
  const [date] = useState([]);
  const [showProfile, setShowProfile] = useState(false); // Nouvel état pour gérer l'affichage du profil

  const handleShowProfile = () => {
    setShowProfile(true);
  };

  const handleHideProfile = () => {
    setShowProfile(false);
  };

  return (
    <div className="homePageRoot">
      <div className="homeTest">
        <div className="headerApp homePageHeader">
          <h1 className="titleFont titleFontSize">BirthDate</h1>
          {isLoggedIn && (
            <div className="homePageUser">
              <div className="homePageCurrentUser">
                <img
                  src={`https://api.dicebear.com/8.x/bottts/svg?seed=${currentUser.surname}`}
                  alt="avatar"
                  className="avatar"
                />
                <button onClick={handleShowProfile} className="btnProfile">
                  {currentUser && currentUser.name}
                </button>
              </div>
              <button className="bntLogout" onClick={logOut}>
                LogOut
              </button>
            </div>
          )}
        </div>
      </div>

      {isLoggedIn &&
        (showProfile ? <ProfilDetails /> : <DateList date={date} />)}

      {/* Ajout d'un bouton pour retourner à la liste des dates */}
      {isLoggedIn && showProfile && (
        <button onClick={handleHideProfile} className="btnBackToDateList">
          Back to Date List
        </button>
      )}
    </div>
  );
};

export default Home;
