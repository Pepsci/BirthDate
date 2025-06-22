import React, { useState } from "react";
import apiHandler from "../../api/apiHandler";
import { Link, useNavigate } from "react-router-dom";

function ForgotPassword() {
  const [email, setEmail] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await apiHandler.requestPasswordReset(email);
      alert("Email de réinitialisation envoyé!");
      navigate("/");
    } catch (err) {
      console.error(err);
      alert("Une erreur s'est produite.");
    }
  };

  return (
    <div className="form-connect">
      <div className="peel">
        <form className="form" onSubmit={handleSubmit}>
          <h3 className="form-title-font-h3">Entrez votre Email</h3>
          <input
            type="email"
            className="form-input forgotPassword-input"
            placeholder=" Votre Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <button className="btnLog" type="submit">
            Réinitialiser le mot de passe
          </button>
        </form>
      </div>
      <div className="btn-link">
        <Link to={"/login"}>
          <button className="btnAcount font">Retour</button>
        </Link>
      </div>
    </div>
  );
}

export default ForgotPassword;
