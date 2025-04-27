// src/components/UnsubscribeSuccess.jsx
import React from "react";
import { Link } from "react-router-dom";

function UnsubscribeSuccess() {
  return (
    <div className="unsubscribe-success">
      <h1>Désabonnement réussi</h1>
      <p>Vous avez été désabonné avec succès des notifications.</p>
      <p>
        <Link to="/login">Se connecter</Link> pour gérer davantage vos
        préférences.
      </p>
    </div>
  );
}

export default UnsubscribeSuccess;
