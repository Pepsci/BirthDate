import React from "react";
import { useNavigate } from "react-router-dom";
import "./LandingPage.css";

const LandingPage = () => {
  const navigate = useNavigate();

  const handleGetStarted = () => {
    navigate("/login");
  };

  return (
    <div className="landing-container">
      <h1>Bienvenue sur BirthReminder</h1>
      <p>Organisez vos rappels d'anniversaire en toute simplicité.</p>
      <button onClick={handleGetStarted} className="btn-start">
        Commencer
      </button>
    </div>
  );
};

export default LandingPage;
