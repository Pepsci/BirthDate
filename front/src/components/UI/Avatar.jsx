import { useState } from "react";
import "./css/avatar.css";

/**
 * Avatar réutilisable : affiche la photo (uploadée ou DiceBear) et bascule
 * sur les initiales si l'image manque ou échoue à charger.
 *
 * Props :
 *  - src         URL de l'avatar (photo ou DiceBear)
 *  - name/surname pour les initiales de repli
 *  - size        "xs" | "sm" | "md" | "lg" (défaut "md")
 *  - online      true/false → pastille de présence (optionnel)
 */
export default function Avatar({
  src,
  name = "",
  surname = "",
  size = "md",
  online,
  className = "",
}) {
  const [failed, setFailed] = useState(false);
  const initials =
    `${name.charAt(0)}${surname.charAt(0)}`.toUpperCase() || "?";
  const showImg = src && !failed;

  return (
    <span className={`br-avatar br-avatar--${size} ${className}`}>
      {showImg ? (
        <img
          src={src}
          alt=""
          className="br-avatar-img"
          onError={() => setFailed(true)}
        />
      ) : (
        <span className="br-avatar-initials">{initials}</span>
      )}
      {online != null && (
        <span
          className={`br-avatar-dot ${online ? "br-avatar-dot--on" : "br-avatar-dot--off"}`}
        />
      )}
    </span>
  );
}
