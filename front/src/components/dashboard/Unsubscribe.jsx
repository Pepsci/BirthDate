import React, { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import apiHandler from "../../api/apiHandler";

const Unsubscribe = () => {
  const [message, setMessage] = useState("Chargement...");
  const location = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const userId = params.get("userId");

    if (userId) {
      apiHandler
        .get(`/api/unsubscribe?userId=${userId}`)
        .then((response) => {
          setMessage(response.data);
        })
        .catch((error) => {
          console.error("Erreur lors de la désinscription :", error);
          setMessage(
            "Erreur lors de la désinscription. Veuillez réessayer plus tard."
          );
        });
    } else {
      setMessage("Identifiant utilisateur manquant.");
    }
  }, [location.search]);

  return (
    <div className="unsubscribe-container">
      <h1>Désinscription</h1>
      <p>{message}</p>
    </div>
  );
};

export default Unsubscribe;
