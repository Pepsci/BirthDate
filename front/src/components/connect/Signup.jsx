import React, { useRef, useState, useContext, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import apiHandler from "../../api/apiHandler";
import axios from "axios";
import { AuthContext } from "../../context/auth.context";

const Signup = () => {
  const [user, setUser] = useState({
    name: "",
    surname: "",
    email: "",
    password: "",
  });

  const [erroMessage, setErrorMessage] = useState(undefined);
  const { authenticateUser, isLoggedIn } = useContext(AuthContext);

  useEffect(() => {
    authenticateUser();
    if (isLoggedIn) navigate("/home");
  }, [isLoggedIn]);

  const avatarRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    authenticateUser();
    if (isLoggedIn) navigate("/home");
  }, [isLoggedIn]);

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
    try {
      const baseUrl = import.meta.env.VITE_APP_BACKEND_URL.replace(
        "http://",
        "https://"
      );
      await apiHandler.post(`${baseUrl}/signup`, user);
      navigate("/login");
    } catch (err) {
      setErrorMessage((prevValue) => err.response.data.message);
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
            placeholder="Prenom"
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
            placeholder="Nom"
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
            placeholder="Votre Email"
            value={user.email}
            onChange={(e) => {
              setUser({ ...user, email: e.target.value });
            }}
          />
          <input
            type="password"
            name="password"
            id="password"
            className="form-input "
            placeholder="Mot de passe"
            value={user.password}
            onChange={(e) => {
              setUser({ ...user, password: e.target.value });
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
          <button>Créer mon compte</button>
        </form>
      </div>
      {erroMessage && (
        <p className="error-message fontErrorMessage">{erroMessage}</p>
      )}
      <Link to={"/login"}>
        <span className="formConnectMessage font">Déjà un compte ?</span>
      </Link>
    </div>
  );
};

export default Signup;
