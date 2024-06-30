import React, { useState } from "react";
import { useParams } from "react-router-dom";
import { useNavigate } from "react-router-dom"; // Remplacez useHistory par useNavigate
import apiHandler from "../../api/apiHandler";

function ResetPassword() {
  const [password, setPassword] = useState("");
  const { token } = useParams();
  const navigate = useNavigate(); // Utilisez useNavigate au lieu de useHistory

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await apiHandler.resetPassword(token, password);
      alert("Mot de passe réinitialisé avec succès!");
      navigate("/login"); // Utilisez navigate au lieu de history.push
    } catch (err) {
      console.error(err);
      console.log(err);
      alert("Une erreur s'est produite.");
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />
      <button type="submit">Valider le nouveau mot de passe</button>
    </form>
  );
}

export default ResetPassword;
