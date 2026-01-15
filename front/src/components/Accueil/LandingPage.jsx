import React from "react";
import { useNavigate } from "react-router-dom";
import "./LandingPage.css";
import Logo from "./Logo+nom-couleur.png";

const LandingPage = () => {
  const navigate = useNavigate();

  const handleGetStarted = () => {
    navigate("/login");
  };

  return (
    <div className="landing-container">
      <img className="landingPage_logo" src={Logo} alt="BirthReminder" />
      <div className="welcome">
        <h1>Bienvenue</h1>
        <p>Organisez vos rappels d'anniversaire en toute simplicité.</p>
        <button onClick={handleGetStarted} className="btn-start">
          Commencer
        </button>
      </div>
    </div>
  );
};

export default LandingPage;
