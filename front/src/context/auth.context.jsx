import React, { useState, useEffect } from "react";
import apiHandler from "../api/apiHandler";
import socketService from "../components/services/socket.service";
import { clearPrivateKey } from "../utils/encryption";

const AuthContext = React.createContext();

function AuthProviderWrapper({ children }) {
  const [auth, setAuth] = useState({
    currentUser: null,
    isLoading: true,
    isLoggedIn: false,
    authToken: null,
  });

  useEffect(() => {
    authenticateUser();
  }, []);

  // Connecter le socket automatiquement quand l'utilisateur est authentifié
  useEffect(() => {
    if (auth.isLoggedIn && auth.authToken) {
      socketService.connect(auth.authToken);
    } else if (!auth.isLoggedIn) {
      socketService.disconnect();
    }
  }, [auth.isLoggedIn, auth.authToken]);

  const authenticateUser = () => {
    apiHandler
      .isLoggedIn()
      .then((data) => {
        const { authToken, ...user } = data;
        if (authToken) {
          localStorage.setItem("authToken", authToken);
        }
        setAuth({
          currentUser: user,
          isLoading: false,
          isLoggedIn: true,
          authToken: authToken || null,
        });
      })
      .catch(() => {
        localStorage.removeItem("authToken");
        setAuth({ currentUser: null, isLoading: false, isLoggedIn: false, authToken: null });
      });
  };

  const storeToken = (token) => {
    localStorage.setItem("authToken", token);
    setAuth((prev) => ({ ...prev, authToken: token }));
  };

  // ── Mise à jour immédiate de currentUser sans appel API ──────────────────
  const updateUser = (userData) => {
    setAuth((prev) => ({ ...prev, currentUser: userData }));
  };

  const logOut = () => {
    localStorage.removeItem("authToken");
    clearPrivateKey(); // Supprime la clé privée E2E de sessionStorage
    apiHandler.logout().catch(() => {});
    setAuth({ currentUser: null, isLoading: false, isLoggedIn: false, authToken: null });
  };

  // ── Mise à jour de la session auth depuis des données déjà fetchées ────────
  // Évite un double appel API après login (les données viennent de isLoggedIn())
  const setUserSession = (user) => {
    setAuth((prev) => ({
      ...prev,
      currentUser: user,
      isLoading: false,
      isLoggedIn: true,
    }));
  };

  const removeUser = () => {
    logOut();
  };

  const removeToken = () => {
    localStorage.removeItem("authToken");
    setAuth((prev) => ({ ...prev, authToken: null }));
  };

  const Authvalues = {
    currentUser: auth.currentUser,
    isLoading: auth.isLoading,
    isLoggedIn: auth.isLoggedIn,
    storeToken,
    authenticateUser,
    updateUser,
    setUserSession,
    removeUser,
    removeToken,
    logOut,
  };

  return (
    <AuthContext.Provider value={Authvalues}>{children}</AuthContext.Provider>
  );
}

export { AuthProviderWrapper, AuthContext };