import React, { useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { KeyRound } from "lucide-react";
import apiHandler from "../../api/apiHandler";
import PasswordInput from "./PasswordInput";
import "./resetPassword.css";

/**
 * Écran atteint depuis le lien du mail de récupération (/auth/reset/:token).
 *
 * Il n'emprunte plus les classes .auth-panel de authpage.css : celles-ci sont
 * calibrées pour le carrousel à trois volets de la page de connexion et
 * cassaient l'affichage ici.
 *
 * Les règles affichées sont exactement celles appliquées par le serveur
 * (8 caractères, une majuscule, une minuscule, un chiffre). Auparavant le
 * client n'en exigeait que 6, si bien qu'une saisie valide côté navigateur
 * était refusée par l'API, avec un message d'erreur en anglais.
 */
function ResetPassword() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const { token } = useParams();
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const rules = useMemo(
    () => [
      { label: "8 caractères minimum", ok: password.length >= 8 },
      { label: "Une majuscule", ok: /[A-Z]/.test(password) },
      { label: "Une minuscule", ok: /[a-z]/.test(password) },
      { label: "Un chiffre", ok: /\d/.test(password) },
      {
        label: "Les deux saisies sont identiques",
        ok: password.length > 0 && password === confirmPassword,
      },
    ],
    [password, confirmPassword],
  );

  const allValid = rules.every((r) => r.ok);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!allValid || submitting) return;
    setError("");
    setSuccess("");
    setSubmitting(true);

    try {
      await apiHandler.resetPassword(token, password);
      setSuccess("Mot de passe réinitialisé. Redirection vers la connexion…");
      setTimeout(() => navigate("/login"), 2000);
    } catch (err) {
      console.error(err);
      setError(
        err.message ||
          "Une erreur s'est produite. Le lien a peut-être expiré : demandez-en un nouveau.",
      );
      setSubmitting(false);
    }
  };

  return (
    <div className="rp-page">
      <div className="rp-card">
        <div className="rp-header">
          <div className="rp-icon">
            <KeyRound size={26} />
          </div>
          <h1 className="rp-title">Nouveau mot de passe</h1>
          <p className="rp-sub">
            Choisissez un mot de passe pour retrouver l'accès à votre compte.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="rp-form">
          <div className="rp-field">
            <label className="rp-label" htmlFor="rp-new">
              Nouveau mot de passe
            </label>
            <PasswordInput
              id="rp-new"
              className="rp-input"
              placeholder="Votre nouveau mot de passe"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              required
            />
          </div>

          <div className="rp-field">
            <label className="rp-label" htmlFor="rp-confirm">
              Confirmer le mot de passe
            </label>
            <PasswordInput
              id="rp-confirm"
              className="rp-input"
              placeholder="Saisissez-le à nouveau"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              required
            />
          </div>

          <ul className="rp-rules">
            {rules.map((rule) => (
              <li
                key={rule.label}
                className={`rp-rule ${rule.ok ? "rp-rule--ok" : ""}`}
              >
                <span className="rp-rule-mark">{rule.ok ? "✓" : "•"}</span>
                {rule.label}
              </li>
            ))}
          </ul>

          {error && <p className="rp-msg rp-msg--error">{error}</p>}
          {success && <p className="rp-msg rp-msg--success">{success}</p>}

          <button
            type="submit"
            className="rp-submit"
            disabled={!allValid || submitting}
          >
            {submitting ? "Enregistrement…" : "Valider le nouveau mot de passe"}
          </button>
        </form>

        <p className="rp-note">
          <strong>À propos de vos messages chiffrés.</strong> Votre clé de
          chiffrement est protégée par votre mot de passe : la réinitialiser
          rend illisibles les messages échangés jusqu'ici. Si vous avez activé
          le chiffrement maximum, ressaisissez votre phrase de récupération de
          12 mots depuis Profil, Chiffrement, et vous les retrouverez.
        </p>

        <p className="rp-back">
          <button
            type="button"
            className="rp-back-btn"
            onClick={() => navigate("/login")}
          >
            ← Retour à la connexion
          </button>
        </p>
      </div>
    </div>
  );
}

export default ResetPassword;
