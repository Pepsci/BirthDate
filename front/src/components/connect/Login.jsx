import React, { useContext, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import apiHandler from "../../api/apiHandler";
import { AuthContext } from "../../context/auth.context";
import "./form.css";

const Login = () => {
  const [user, setUser] = useState({
    email: "",
    password: "",
  });
  const [errorMessage, setErrorMessage] = useState(undefined);

  const navigate = useNavigate();
  const { storeToken, authenticateUser, isLoggedIn } = useContext(AuthContext);

  useEffect(() => {
    authenticateUser();
    if (isLoggedIn) navigate("/home");
  }, [isLoggedIn]);

  const handleSubmit = async (event) => {
    event.preventDefault();

    try {
      const response = await apiHandler.signin({
        email: user.email, // Utilise les valeurs de l'état
        password: user.password,
      });

      console.log("Response data:", response);

      if (response && response.authToken) {
        // Utilise le jeton d'authentification ici
        console.log("Login successful");
        console.log("AuthToken:", response.authToken);
        storeToken(response.authToken);
        authenticateUser();
        navigate("/home");
      } else {
        console.error("No authToken in response");
      }
    } catch (error) {
      console.error("Error during login:", error);
      setErrorMessage(
        "Une erreur est survenue lors de la connexion. Veuillez réessayer."
      );
    }
  };

  return (
    <div className="form-connect">
      <div className="peel">
        <form action="" className="form" onSubmit={handleSubmit}>
          <h1 className="form-title-font">Connexion</h1>
          <input
            type="text"
            name="email"
            id="email"
            className="form-input"
            placeholder="Entrez votre Email"
            value={user.email}
            onChange={(e) =>
              setUser({ ...user, email: e.target.value.toLowerCase() })
            }
          />

          <input
            type="password"
            name="password"
            id="password"
            className="form-input"
            placeholder="Entrez votre mot de passe"
            value={user.password}
            onChange={(e) => setUser({ ...user, password: e.target.value })}
          />

          <button>Se connecter</button>
        </form>
      </div>

      <div className="form-connect-message font fontErrorMessage">
        {errorMessage && <p className="error-message ">{errorMessage}</p>}
        <Link to={"/forgot-password"}>
          <br />
          <span className="form-connect-msg">Mot de passe oublié ?</span>
        </Link>
        <span> / </span>
        <Link to={"/"}>
          <span className="form-connect-msg">Pas encore de compte ?</span>
        </Link>
      </div>
    </div>
  );
};

export default Login;
