import { useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";

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
      const response = await fetch(
        `${import.meta.env.VITE_APP_BACKEND_URL}/verify-email`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ token }),
        }
      );

      if (response.ok) {
        setStatus("Adresse email vérifiée avec succès !");
        setTimeout(() => {
          navigate("/login");
        }, 2000);
      } else {
        setStatus("Échec de la vérification de l'email.");
      }
    } catch (error) {
      console.error("Erreur lors de la vérification :", error);
      setStatus("Une erreur est survenue.");
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
