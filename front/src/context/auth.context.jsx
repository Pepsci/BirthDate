import React, { useState, useEffect } from "react";
import apiHandler from "../api/apiHandler";

const AuthContext = React.createContext();

function AuthProviderWrapper({ children }) {
  const [auth, setAuth] = useState({
    currentUser: null,
    isLoading: true,
    isLoggedIn: false,
  });

  useEffect(() => {
    authenticateUser();
  }, []);

  const authenticateUser = () => {
    const storedToken = localStorage.getItem("authToken");
    if (storedToken) {
      apiHandler
        .isLoggedIn(storedToken)
        .then((user) => {
          setAuth({ currentUser: user, isLoading: false, isLoggedIn: true });
        })
        .catch((e) => {
          setAuth({ currentUser: null, isLoading: false, isLoggedIn: false });
        });
    } else {
      setAuth({ currentUser: null, isLoading: false, isLoggedIn: false });
    }
  };

  const removeUser = () => {
    removeToken();
    authenticateUser();
  };

  const removeToken = () => {
    localStorage.removeItem("authToken");
  };

  const logOut = () => {
    removeToken();
    authenticateUser();
  };

  const storeToken = (token) => {
    localStorage.setItem("authToken", token);
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
