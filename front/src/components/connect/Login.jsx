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

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const dbResponse = await apiHandler.post("/login", user);

      // store the jwt token in local storage
      storeToken(dbResponse.data.authToken);

      //verify the token
      authenticateUser();

      // redirect to home
      navigate("/");
    } catch (error) {
      const errorDescription = error.response.data.message;
      setErrorMessage(errorDescription);
    }
  };

  return (
    <div className="form-connect">
      <div className="peel">
        <form action="" className="form" onSubmit={handleSubmit}>
          <h1 className="form-title-font">Login</h1>
          {/* <label htmlFor="email" className="form-label">
          Email
        </label> */}
          <input
            type="text"
            name="email"
            id="email"
            className="form-input"
            placeholder="Enter your email"
            value={user.email}
            onChange={(e) =>
              setUser({ ...user, email: e.target.value.toLowerCase() })
            }
          />

          {/* <label htmlFor="password" className="form-label">
          Password
        </label> */}
          <input
            type="password"
            name="password"
            id="password"
            className="form-input"
            placeholder="Enter your password"
            value={user.password}
            onChange={(e) => setUser({ ...user, password: e.target.value })}
          />

          <button>Login</button>
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
