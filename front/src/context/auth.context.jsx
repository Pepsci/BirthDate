import React, { useState, useEffect } from "react";
import apiHandler from "../api/apiHandler";
import socketService from "../components/services/socket.service";

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
        setAuth({
          currentUser: user,
          isLoading: false,
          isLoggedIn: true,
          authToken: authToken || null,
        });
      })
      .catch(() => {
        setAuth({ currentUser: null, isLoading: false, isLoggedIn: false, authToken: null });
      });
  };

  // Appelé après login : stocke le token en mémoire (state React uniquement, pas localStorage)
  const storeToken = (token) => {
    setAuth((prev) => ({ ...prev, authToken: token }));
  };

  const logOut = () => {
    apiHandler.logout().catch(() => {});
    setAuth({ currentUser: null, isLoading: false, isLoggedIn: false, authToken: null });
  };

  const removeUser = () => {
    logOut();
  };

  const removeToken = () => {
    setAuth((prev) => ({ ...prev, authToken: null }));
  };

  const Authvalues = {
    currentUser: auth.currentUser,
    isLoading: auth.isLoading,
    isLoggedIn: auth.isLoggedIn,
    storeToken,
    authenticateUser,
    removeUser,
    removeToken,
    logOut,
  };

  return (
    <AuthContext.Provider value={Authvalues}>{children}</AuthContext.Provider>
  );
}

export { AuthProviderWrapper, AuthContext };
