import React, { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import apiHandler from "../../api/apiHandler";

const Unsubscribe = () => {
  const [message, setMessage] = useState("Chargement...");
  const location = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const userId = params.get("userId");
    console.log("UserID:", userId); // Ajoutez ceci pour vérifier le userId

    if (userId) {
      apiHandler
        .get(`/api/unsubscribe?userId=${userId}`)
        .then((response) => {
          console.log("Unsubscribe response:", response.data); // Ajoutez ceci pour vérifier la réponse
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
