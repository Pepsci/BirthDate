import { useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import apiHandler from "../../api/apiHandler";

function VerifyEmail() {
  const [status, setStatus] = useState("");
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Récupérer le token depuis l'URL
  const token = searchParams.get("token");

  const verifyEmail = async () => {
    if (!token) {
      setStatus("Token de vérification introuvable.");
      return;
    }

    try {
      // Utiliser votre apiHandler au lieu de fetch
      const response = await apiHandler.verifyEmail(token);
      setStatus("Adresse email vérifiée avec succès !");
      setTimeout(() => {
        navigate("/login");
      }, 2000);
    } catch (error) {
      console.error("Erreur lors de la vérification :", error);
      setStatus("Échec de la vérification de l'email.");
    }
  };

  return (
    <div>
      <h1>Vérification de l'email</h1>
      <button onClick={verifyEmail}>Vérifier mon email</button>
      <p>{status}</p>
    </div>
  );
}

export default VerifyEmail;
