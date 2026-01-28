import React, { useContext, useEffect, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import apiHandler from "../../api/apiHandler";
import { AuthContext } from "../../context/auth.context";
import "./form.css";
import PasswordInput from "./PasswordInput";

const Login = () => {
  const [user, setUser] = useState({
    email: "",
    password: "",
  });
  const [errorMessage, setErrorMessage] = useState(undefined);

  const navigate = useNavigate();
  const location = useLocation();
  const { storeToken, authenticateUser, isLoggedIn } = useContext(AuthContext);

  // Récupérer la page d'origine (ou /home par défaut)
  const from = location.state?.from?.pathname || "/home";

  useEffect(() => {
    authenticateUser();
    if (isLoggedIn) navigate(from);
  }, [isLoggedIn, navigate, from]);

  const handleSubmit = async (event) => {
    event.preventDefault();

    try {
      const response = await apiHandler.signin({
        email: user.email,
        password: user.password,
      });

      if (response && response.authToken) {
        console.log("Login successful");
        storeToken(response.authToken);
        authenticateUser();
        navigate(from);
      } else {
        setErrorMessage("No authToken in response");
      }
    } catch (err) {
      setErrorMessage(err.message || "Une erreur s'est produite.");
      console.error(err);
    }
  };

  // Afficher un message si l'utilisateur vient de /friends
  const isFromFriends = location.state?.from?.pathname === "/friends";

  return (
    <div className="form-connect">
      <div className="peel">
        <form action="" className="form" onSubmit={handleSubmit}>
          <h1 className="form-title-font">Connexion</h1>

          {/* Message d'info si l'utilisateur vient de l'email */}
          {isFromFriends && (
            <div
              style={{
                padding: "10px",
                marginBottom: "15px",
                backgroundColor: "#e3f2fd",
                border: "1px solid #2196F3",
                borderRadius: "5px",
                color: "#1976d2",
                fontSize: "0.9rem",
              }}
            >
              ℹ️ Connectez-vous pour voir votre demande d'ami
            </div>
          )}

          <input
            type="text"
            name="email"
            id="email"
            className="form-input"
            placeholder=" Entrez votre Email"
            value={user.email}
            onChange={(e) =>
              setUser({ ...user, email: e.target.value.toLowerCase() })
            }
          />

          <PasswordInput
            type="password"
            name="password"
            id="password"
            className="form-input"
            placeholder=" Entrez votre mot de passe"
            value={user.password}
            onChange={(e) => setUser({ ...user, password: e.target.value })}
          />

          <button className="btnLog">Se connecter</button>
        </form>
      </div>

      <div className="form-connect-message font fontErrorMessage">
        {errorMessage && <span className="error-message ">{errorMessage}</span>}
        <div className="btnLogin">
          <Link to={"/forgot-password"}>
            <button className="btnAcount">Mot de passe oublié ?</button>
          </Link>
          <Link to={"/signup"}>
            <button className="btnAcount">Pas encore de compte ?</button>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Login;
