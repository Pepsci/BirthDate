import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import apiHandler from "../../api/apiHandler";

function ResetPassword() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const { token } = useParams();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      alert("Les mots de passe ne correspondent pas. Veuillez réessayer.");
      return;
    }
    try {
      await apiHandler.resetPassword(token, password);
      alert("Mot de passe réinitialisé avec succès!");
      navigate("/login");
    } catch (err) {
      console.error(err);
      alert("Une erreur s'est produite.");
    }
  };

  return (
    <div className="form-connect">
      <div className="peel">
        <form className="form" onSubmit={handleSubmit}>
          <h3 className="form-title-font-h3">
            Entrez votre nouveau mot de passe
          </h3>
          <input
            type="password"
            className="form-input"
            value={password}
            placeholder="Nouveau mot de passe"
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <input
            type="password"
            name="confirmPassword"
            id="confirmPassword"
            className="form-input"
            placeholder="Confirmez le mot de passe"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />
          <button type="submit">Valider le nouveau mot de passe</button>
        </form>
      </div>
    </div>
  );
}

export default ResetPassword;
