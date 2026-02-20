import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import apiHandler from "../../api/apiHandler";
import "./verifyEmail.css";

function VerifyEmail() {
  const [status, setStatus] = useState("Vérification en cours...");
  const [isSuccess, setIsSuccess] = useState(null);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const token = searchParams.get("token");

  useEffect(() => {
    const verify = async () => {
      if (!token) {
        setStatus("Token de vérification introuvable.");
        setIsSuccess(false);
        return;
      }

      try {
        await apiHandler.verifyEmail(token);
        setStatus("Adresse email vérifiée avec succès ! 🎉");
        setIsSuccess(true);
        setTimeout(() => navigate("/login"), 3000);
      } catch (error) {
        console.error("Erreur lors de la vérification :", error);
        setStatus("Échec de la vérification. Le lien est peut-être expiré.");
        setIsSuccess(false);
      }
    };

    verify();
  }, [token]);

  return (
    <div className="verify-page">
      <div className="verify-card">
        <h1 className="verify-brand">🎉 BirthReminder</h1>
        <h2 className="verify-title">Vérification de l'email</h2>

        {isSuccess === null && <div className="verify-spinner" />}

        {isSuccess === true && <div className="verify-icon">✅</div>}

        {isSuccess === false && <div className="verify-icon">❌</div>}

        <p className="verify-status">{status}</p>

        {isSuccess === true && (
          <p className="verify-redirect">
            Redirection vers la connexion dans 3 secondes...
          </p>
        )}

        {isSuccess === false && (
          <button className="verify-btn" onClick={() => navigate("/login")}>
            Retour à la connexion
          </button>
        )}
      </div>
    </div>
  );
}

export default VerifyEmail;
