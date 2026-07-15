import React from "react";
import useAuth from "../context/useAuth";
import { Navigate, Outlet } from "react-router-dom";

// Route réservée aux admins. La vraie sécurité est côté API (middleware isAdmin) ;
// ceci ne fait que masquer l'UI aux non-admins.
const AdminRoute = () => {
  const { isLoggedIn, isLoading, currentUser } = useAuth();

  if (isLoading) return <p>Loading...</p>;
  if (!isLoggedIn) return <Navigate to="/login" replace />;
  if (currentUser?.role !== "admin") return <Navigate to="/home" replace />;

  return <Outlet />;
};

export default AdminRoute;
