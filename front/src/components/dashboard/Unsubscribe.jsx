import React, { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import apiHandler from "../../api/apiHandler";

function Unsubscribe() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState("loading");
  const [message, setMessage] = useState("");

  // ⚠️ URLSearchParams.get() est SENSIBLE À LA CASSE. Tous les emails
  // construisent leurs liens en `?userId=…&dateId=…` (camelCase) alors que
  // cette page lisait "userid" et "dateid" en minuscules : la valeur était donc
  // toujours nulle et chaque lien « se désabonner » affichait « ID utilisateur
  // manquant ». On accepte les deux graphies pour couvrir aussi les emails
  // déjà partis dans les boîtes de réception.
  const userId = searchParams.get("userId") || searchParams.get("userid");
  const dateId = searchParams.get("dateId") || searchParams.get("dateid");
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
        const { data } = await apiHandler.post("/unsubscribe", {
          userId,
          dateId,
          type,
        });

        setStatus("success");
        // Le serveur sait ce qu'il a coupé (récap mensuel, fêtes, un
        // anniversaire précis…) : on affiche SON message plutôt qu'un texte
        // générique parlant d'anniversaires, faux dans la plupart des cas.
        setMessage(
          data?.message ||
            "Vous avez été désabonné avec succès de ces notifications."
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
