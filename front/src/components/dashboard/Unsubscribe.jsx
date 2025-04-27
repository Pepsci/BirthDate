import React, { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import apiHandler from "../../api/apiHandler";

function Unsubscribe() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState("loading");
  const [message, setMessage] = useState("");

  const userId = searchParams.get("userid");
  const dateId = searchParams.get("dateid");
  const type = searchParams.get("type") || "all_birthdays";

  useEffect(() => {
    async function handleUnsubscribe() {
      try {
        if (!userId) {
          setStatus("error");
          setMessage(
            "ID utilisateur manquant. Impossible de traiter votre demande."
          );
          return;
        }

        // Appeler l'API pour désabonner l'utilisateur
        await apiHandler.post("/unsubscribe", {
          userId,
          dateId,
          type,
        });

        setStatus("success");
        setMessage(
          "Vous avez été désabonné avec succès des notifications d'anniversaire."
        );
      } catch (error) {
        console.error("Erreur lors du désabonnement:", error);
        setStatus("error");
        setMessage(
          "Une erreur est survenue lors du traitement de votre demande."
        );
      }
    }

    handleUnsubscribe();
  }, [userId, dateId, type]);

  return (
    <div className="unsubscribe-container">
      <h1>Gestion des notifications</h1>

      {status === "loading" && <p>Traitement de votre demande en cours...</p>}

      {status === "success" && (
        <div className="success-message">
          <h2>Succès !</h2>
          <p>{message}</p>
          <p>
            Vous pouvez désormais fermer cette page ou{" "}
            <a href="/login">vous connecter</a> pour gérer vos préférences.
          </p>
        </div>
      )}

      {status === "error" && (
        <div className="error-message">
          <h2>Erreur</h2>
          <p>{message}</p>
          <p>
            Veuillez <a href="/login">vous connecter</a> pour gérer vos
            préférences de notification.
          </p>
        </div>
      )}
    </div>
  );
}

export default Unsubscribe;
