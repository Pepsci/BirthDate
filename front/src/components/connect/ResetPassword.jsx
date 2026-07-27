import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import apiHandler from "../../api/apiHandler";
import PasswordInput from "./PasswordInput";
import "./authpage.css";

function ResetPassword() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const { token } = useParams();
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (password.length < 6) {
      setError("Le mot de passe doit contenir au moins 6 caractères.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Les mots de passe ne correspondent pas. Veuillez réessayer.");
      return;
    }

    try {
      await apiHandler.resetPassword(token, password);
      setSuccess("Mot de passe réinitialisé avec succès ! Redirection…");
      setTimeout(() => navigate("/login"), 2000);
    } catch (err) {
      console.error(err);
      setError(
        err.message ||
          "Une erreur s'est produite. Le lien a peut-être expiré, redemandez-en un.",
      );
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-shell">
        <div className="auth-panel auth-panel--full">
          <div className="auth-panel-header">
            <h2 className="auth-title">Nouveau mot de passe 🔑</h2>
            <p className="auth-sub">Choisissez un nouveau mot de passe</p>
          </div>

          <form onSubmit={handleSubmit} className="auth-form">
            <div className="auth-field">
              <label className="auth-label">Nouveau mot de passe</label>
              <PasswordInput
                className="auth-input"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                required
              />
            </div>

            <div className="auth-field">
              <label className="auth-label">Confirmer le mot de passe</label>
              <PasswordInput
                className="auth-input"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                required
              />
            </div>

            {error && <p className="auth-msg auth-msg--error">{error}</p>}
            {success && <p className="auth-msg auth-msg--success">{success}</p>}

            <button type="submit" className="auth-btn-primary">
              Valider le nouveau mot de passe
            </button>
          </form>

          <p className="auth-switch-text">
            <button className="auth-link-btn" onClick={() => navigate("/login")}>
              ← Retour à la connexion
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

export default ResetPassword;
