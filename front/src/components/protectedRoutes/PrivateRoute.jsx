import React from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import useAuth from "../context/useAuth";

const PrivateRoute = () => {
  const { isLoggedIn, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="loading-container">
        <p>Chargement...</p>
      </div>
    );
  }

  if (!isLoggedIn) {
    // 👇 IMPORTANT : Sauvegarde l'URL d'origine pour y retourner après connexion
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <Outlet />;
};

export default PrivateRoute;
