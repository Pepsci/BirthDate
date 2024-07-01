import React, { useState } from "react";
import apiHandler from "../../api/apiHandler";
import { useNavigate } from "react-router-dom";

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
    <form onSubmit={handleSubmit}>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      <button type="submit">Réinitialiser le mot de passe</button>
    </form>
  );
}

export default ForgotPassword;
