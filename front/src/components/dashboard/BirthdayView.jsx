import React, { useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import apiHandler from "../../api/apiHandler";
import FriendProfile from "../profil/FriendProfile";

/**
 * Wrapper pour FriendProfile qui récupère l'ID depuis l'URL
 * Utilisé pour la route /birthday/:id (lien dans l'email)
 */
const BirthdayView = () => {
  const { id } = useParams(); // Récupère l'ID depuis l'URL
  const navigate = useNavigate();
  // `?section=shared` ouvre la carte directement sur la liste commune. Le menu
  // « Listes communes » y envoie : choisir une liste dans un menu de listes
  // doit mener à la liste, pas à la fiche qui la porte.
  const [searchParams] = useSearchParams();
  const initialSection = searchParams.get("section") || "info";
  const [birthday, setBirthday] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Charger les données de l'anniversaire depuis l'API
    apiHandler
      .get(`/date/${id}`)
      .then((response) => {
        setBirthday(response.data);
        setLoading(false);
      })
      .catch((error) => {
        console.error("Erreur lors du chargement:", error);
        setError("Impossible de charger cet anniversaire");
        setLoading(false);
      });
  }, [id]);

  // Fonction appelée quand on clique sur "Retour à la liste"
  const handleCancel = () => {
    navigate("/home");
  };

  // État de chargement
  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          minHeight: "100vh",
          fontSize: "1.5rem",
          color: "#667eea",
        }}
      >
        Chargement...
      </div>
    );
  }

  // État d'erreur
  if (error || !birthday) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          minHeight: "100vh",
          gap: "20px",
        }}
      >
        <h2>😕 Oups !</h2>
        <p>{error || "Anniversaire non trouvé"}</p>
        <button
          onClick={() => navigate("/home")}
          style={{
            padding: "12px 30px",
            backgroundColor: "#667eea",
            color: "white",
            border: "none",
            borderRadius: "8px",
            fontSize: "1rem",
            cursor: "pointer",
            fontWeight: "600",
          }}
        >
          Retour à l'accueil
        </button>
      </div>
    );
  }

  // Afficher FriendProfile avec les données chargées
  return (
    <FriendProfile
      date={birthday}
      onCancel={handleCancel}
      initialSection={initialSection}
    />
  );
};

export default BirthdayView;
