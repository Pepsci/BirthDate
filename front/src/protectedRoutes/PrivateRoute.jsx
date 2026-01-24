import React from "react";
import useAuth from "../context/useAuth";
import { Navigate, Outlet, useLocation } from "react-router-dom";

const PrivateRoute = () => {
  const { isLoggedIn, isLoading } = useAuth();
  const location = useLocation(); // 👈 AJOUTER cette ligne

  if (isLoading) return <p>Loading...</p>;

  // 👇 MODIFIER cette ligne pour sauvegarder l'URL d'origine
  if (!isLoggedIn)
    return <Navigate to="/login" state={{ from: location }} replace />;

  return <Outlet />;
};

export default PrivateRoute;
