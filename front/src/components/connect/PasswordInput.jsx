import React, { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

/**
 * Champ mot de passe avec bouton pour afficher / masquer la saisie.
 *
 * Props transmises telles quelles à l'<input> (value, onChange, placeholder,
 * name, id, required, autoComplete...). La prop `className` est appliquée à
 * l'input pour rester cohérent avec les autres champs (ex: "auth-input").
 */
const PasswordInput = ({ className = "", ...inputProps }) => {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="password-input-container">
      <input
        {...inputProps}
        className={className}
        type={showPassword ? "text" : "password"}
      />
      <button
        type="button"
        onClick={() => setShowPassword((v) => !v)}
        className="toggle-password-visibility"
        aria-label={
          showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"
        }
        title={
          showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"
        }
      >
        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  );
};

export default PasswordInput;
