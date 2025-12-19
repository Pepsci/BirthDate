import React, { useRef, useState, useContext, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import apiHandler from "../../api/apiHandler";
import axios from "axios";
import { AuthContext } from "../../context/auth.context";
import PasswordInput from "./PasswordInput";
import "../UI/css/modals.css";

const Signup = () => {
  const [user, setUser] = useState({
    name: "",
    surname: "",
    email: "",
    password: "",
  });

  const [confirmPassword, setConfirmPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState(undefined);
  const [successMessage, setSuccessMessage] = useState(undefined); // État pour le message de succès
  const { authenticateUser, isLoggedIn } = useContext(AuthContext);

  useEffect(() => {
    authenticateUser();
    if (isLoggedIn) navigate("/home");
  }, [isLoggedIn]);

  const avatarRef = useRef(null);
  const navigate = useNavigate();

  const handleAvatar = (input) => {
    axios
      .get(`https://api.dicebear.com/8.x/bottts/svg?seed=${input}`)
      .then(({ data }) => {
        avatarRef.current = data;
      })
      .catch((err) => console.log(err));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validation de l'email au frontend
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(user.email)) {
      setErrorMessage("Veuillez fournir une adresse e-mail valide.");
      return;
    }

    if (user.password !== confirmPassword) {
      setErrorMessage("Les mots de passe ne correspondent pas.");
      return;
    }

    try {
      const response = await apiHandler.signup(user); // Utilise la méthode signup d'apiHandler
      setSuccessMessage("Compte créé avec succès !");
      setErrorMessage(undefined);
      setTimeout(() => {
        navigate("/login");
      }, 3000);
    } catch (err) {
      if (err.message) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage("Une erreur s'est produite.");
      }
      console.error(err);
    }
  };

  return (
    <div className="form-connect">
      <div className="peel">
        <form className="form" onSubmit={handleSubmit}>
          <h1 className="form-title-font">Inscription</h1>
          <input
            type="text"
            name="name"
            id="name"
            className="form-input"
            placeholder=" Prenom"
            value={user.name}
            onChange={(e) => {
              setUser({ ...user, name: e.target.value });
              handleAvatar(e.target.value);
            }}
          />
          <input
            type="text"
            name="surname"
            id="surname"
            className="form-input"
            placeholder=" Nom"
            value={user.surname}
            onChange={(e) => {
              setUser({ ...user, surname: e.target.value });
            }}
          />
          <input
            type="text"
            name="email"
            id="email"
            className="form-input"
            placeholder=" Votre Email"
            value={user.email}
            onChange={(e) => {
              setUser({ ...user, email: e.target.value });
            }}
          />
          <PasswordInput
            type="password"
            name="password"
            id="password"
            className="form-input"
            placeholder=" Mot de passe"
            value={user.password}
            onChange={(e) => {
              setUser({ ...user, password: e.target.value });
            }}
          />
          <PasswordInput
            type="password"
            name="confirmPassword"
            id="confirmPassword"
            className="form-input"
            placeholder=" Confirmez le mot de passe"
            value={confirmPassword}
            onChange={(e) => {
              setConfirmPassword(e.target.value);
            }}
          />
          <div className="formConnectAvatar titleFont">
            <span className="form-connect-msg font">Voici votre avatar</span>
            <img
              src={`https://api.dicebear.com/8.x/bottts/svg?seed=${user.name}`}
              alt="avatar"
              className="avatarSignup"
            />
          </div>
          <button className="btnLog">Créer mon compte</button>
        </form>
      </div>
      <div className="form-connect-message">
        {errorMessage && (
          <p className="error-message fontErrorMessage">{errorMessage}</p>
        )}
        {successMessage && (
          <p className="success-message fontSuccessMessage">{successMessage}</p>
        )}
        <Link to={"/login"}>
          <button className="btnAcount font">Déjà un compte ?</button>
        </Link>
      </div>
    </div>
  );
};

export default Signup;
